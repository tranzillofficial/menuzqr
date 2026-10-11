"""Transport and bitmap tests; no physical printer or Windows required."""
import base64
import http.client
from http.server import HTTPServer
import importlib.util
import json
from pathlib import Path
import threading
import tempfile
import struct
from contextlib import contextmanager
import unittest
import uuid

spec = importlib.util.spec_from_file_location('bridge', Path(__file__).parents[1] / 'public/menuzqr-print-bridge.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


def bitmap(width=384, height=2, **extra):
    return {'protocol':'windows-gdi-v1','paperMm':58 if width==384 else 80,'width': width, 'height': height, 'raster': base64.b64encode(bytes([128]) * (width // 8 * height)).decode(), 'printer': 'Receipt printer', 'jobId': str(uuid.uuid4()), **extra}


class FakePrinters:
    def __init__(self):
        self.jobs = []
        self.fail = False
        self.reject_page = False

    def names(self):
        return ['Receipt printer']

    @contextmanager
    def prepare(self, name, data):
        if self.reject_page: raise ValueError('Unsupported paper size')
        yield data

    def write(self, name, data):
        self.jobs.append((name, data))
        if self.fail:
            raise OSError('Printer disconnected')


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.printers = FakePrinters()
        self.server = HTTPServer(('127.0.0.1', 0), bridge.make_handler(self.printers, 'test-token', {'https://menuzqr.shop'}, lambda ticket, origin: ticket == 'valid-ticket' and origin in ('https://menuzqr.shop','https://mastermart.shop')))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, method, path, body=None, **headers):
        client = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        values = {'Origin': 'https://menuzqr.shop', 'Host': '127.0.0.1:18191', 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json', **headers}
        client.request(method, path, body=json.dumps(body) if body is not None else None, headers=values)
        response = client.getresponse()
        result = (response.status, json.loads(response.read()), dict(response.getheaders()))
        client.close()
        return result

    def test_pairing_origin_and_host_are_required(self):
        self.assertEqual(self.request('GET', '/printers', Authorization='Bearer wrong')[0], 401)
        self.assertEqual(self.request('POST', '/print', bitmap(), Origin='https://menuzqr.shop.evil.example')[0], 403)
        self.assertEqual(self.request('GET', '/printers', Host='evil.example')[0], 403)
        self.assertEqual(self.printers.jobs, [])

    def test_automatic_pairing_requires_ticket_and_binds_origin(self):
        self.assertEqual(self.request('POST', '/pair', {'ticket':'wrong'}, Authorization='')[0], 403)
        self.assertEqual(self.request('POST', '/pair', {'ticket':'valid-ticket'}, Origin='https://evil.example', Authorization='')[0], 403)
        status, data, _ = self.request('POST', '/pair', {'ticket':'valid-ticket'}, Origin='https://mastermart.shop', Authorization='')
        self.assertEqual(status, 200)
        token = data['token']
        self.assertEqual(self.request('GET', '/printers', Origin='https://mastermart.shop', Authorization='Bearer '+token)[0], 200)
        self.assertEqual(self.request('GET', '/printers', Origin='https://evil.example', Authorization='Bearer '+token)[0], 403)
        self.assertEqual(self.request('GET', '/printers', Origin='https://menuzqr.shop', Authorization='Bearer '+token)[0], 401)
        self.assertEqual(self.request('POST', '/pair', {'ticket':'valid-ticket'}, Host='evil.example')[0], 403)

    def test_health_never_exposes_pairing_token(self):
        status, body, _ = self.request('GET', '/health', Authorization='')
        self.assertEqual(status, 200)
        self.assertEqual(body, {'version':5,'app':'MenuzQR Print'})

    def test_automatic_printer_avoids_office_and_ambiguous_queues(self):
        self.assertEqual(bridge.automatic_printer(['Microsoft Print to PDF','POS-80']), 'POS-80')
        self.assertIsNone(bridge.automatic_printer(['HP LaserJet','Microsoft Print to PDF']))
        self.assertIsNone(bridge.automatic_printer(['POS-58','POS-80']))
        self.assertIsNone(bridge.automatic_printer(['Thermal Label Printer']))

    def test_preflight_and_printer_discovery(self):
        status, _, headers = self.request('OPTIONS', '/print')
        self.assertEqual(status, 200)
        self.assertEqual(headers['Access-Control-Allow-Origin'], 'https://menuzqr.shop')
        self.assertEqual(headers['Access-Control-Allow-Private-Network'], 'true')
        self.assertEqual(self.request('GET', '/printers')[1]['printers'], ['Receipt printer'])

    def test_retry_enqueues_only_once(self):
        body = bitmap()
        self.assertEqual(self.request('POST', '/print', body)[0], 200)
        self.assertEqual(self.request('POST', '/print', body)[0], 200)
        self.assertEqual(len(self.printers.jobs), 1)

    def test_ambiguous_failure_cannot_enqueue_again(self):
        self.printers.fail = True
        body = bitmap()
        self.assertEqual(self.request('POST', '/print', body)[0], 503)
        self.assertEqual(self.request('POST', '/print', body)[0], 409)
        self.assertEqual(len(self.printers.jobs), 1)

    def test_invalid_bitmap_and_printer_do_not_print(self):
        for body in [bitmap(raster='bad'), bitmap(printer='Unknown printer'), bitmap(width=400), bitmap(height=20001)]:
            self.assertEqual(self.request('POST', '/print', body)[0], 400)
        self.assertEqual(self.printers.jobs, [])

    def test_receipt_validation_and_test_limit(self):
        for body in [bitmap(protocol='raw'),bitmap(paperMm=210),bitmap(height=161,testPrint=True)]:
            self.assertEqual(self.request('POST','/print',body)[0],400)
        self.assertEqual(self.printers.jobs,[])
        job=bridge.receipt_bitmap(bitmap(height=68,testPrint=True))
        self.assertEqual(job['length'],25)
        self.assertEqual(len(job['raster']),48*68)

    def test_driver_preferences_keep_private_data_and_force_one_portrait_copy(self):
        dev=bytearray(300)
        struct.pack_into('<H',dev,68,220)
        struct.pack_into('<I',dev,72,0x10000)
        dev[220:]=b'x'*80
        bridge.configure_devmode(dev,58,40)
        self.assertEqual(struct.unpack_from('<hhhhhh',dev,76),(1,0,400,580,100,1))
        self.assertEqual(dev[220:],b'x'*80)
        self.assertFalse(struct.unpack_from('<I',dev,72)[0]&0x10000)

    def test_reject_driver_long_page_rotation_or_clipping_before_spooling(self):
        job=bridge.receipt_bitmap(bitmap(height=68,testPrint=True))
        self.assertEqual(bridge.page_geometry(job,[203,203,464,200,384,180]),(384,68))
        for caps in ([203,203,464,2374,384,2300], [203,203,2374,464,2300,384], [203,203,464,200,100,180], [203,203,464,200,384,10]):
            with self.assertRaises(ValueError): bridge.page_geometry(job,caps)

    def test_gdi_one_document_one_page_and_abort_on_render_failure(self):
        class Gdi:
            def __init__(self): self.calls=[]; self.fail=False
            def StartDocW(self,*args): self.calls.append('document'); return 1
            def StartPage(self,*args): self.calls.append('page'); return 1
            def StretchDIBits(self,*args):
                self.calls.append('bitmap')
                self.info=ctypes.string_at(args[10],48)
                return 0 if self.fail else 68
            def EndPage(self,*args): self.calls.append('endpage'); return 1
            def EndDoc(self,*args): self.calls.append('enddoc'); return 1
            def AbortDoc(self,*args): self.calls.append('abort'); return 1
        import ctypes
        printer=object.__new__(bridge.WindowsPrinters); printer.gdi=Gdi()
        job=bridge.receipt_bitmap(bitmap(height=68))
        printer.write('Test',(1,(384,68),job))
        self.assertEqual(printer.gdi.calls,['document','page','bitmap','endpage','enddoc'])
        self.assertEqual(struct.unpack_from('<ii',printer.gdi.info,4),(384,-68))
        printer.gdi.calls=[];printer.gdi.fail=True
        with self.assertRaises(RuntimeError): printer.write('Test',(1,(384,68),job))
        self.assertEqual(printer.gdi.calls,['document','page','bitmap','abort'])

    def test_rejected_driver_page_is_retryable_without_creating_a_job(self):
        body=bitmap()
        self.printers.reject_page=True
        self.assertEqual(self.request('POST','/print',body)[0],400)
        self.assertEqual(self.printers.jobs,[])
        self.printers.reject_page=False
        self.assertEqual(self.request('POST','/print',body)[0],200)
        self.assertEqual(len(self.printers.jobs),1)

    def test_persistent_jobs_survive_bridge_restart(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'jobs.sqlite3'
            job=str(uuid.uuid4())
            first=bridge.JobStore(path)
            self.assertIsNone(first.get(job))
            first.put(job,False)
            self.assertIs(bridge.JobStore(path).get(job),False)
            first.put(job,True)
            self.assertIs(bridge.JobStore(path).get(job),True)
            # Fresh handler with persisted successful job must not write again.
            handler=bridge.make_handler(self.printers,'test-token',{'https://menuzqr.shop'},job_store=bridge.JobStore(path))
            self.server.RequestHandlerClass=handler
            self.assertTrue(self.request('POST','/print',bitmap(jobId=job))[1]['duplicate'])
            self.assertEqual(self.printers.jobs,[])


if __name__ == '__main__':
    unittest.main()
