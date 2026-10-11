"""Transport and bitmap tests; no physical printer or Windows required."""
import base64
import http.client
from http.server import HTTPServer
import importlib.util
import json
from pathlib import Path
import threading
import tempfile
import unittest
import uuid

spec = importlib.util.spec_from_file_location('bridge', Path(__file__).parents[1] / 'public/menuzqr-print-bridge.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


def bitmap(width=384, height=2, **extra):
    return {'width': width, 'height': height, 'raster': base64.b64encode(bytes([128]) * (width // 8 * height)).decode(), 'printer': 'Receipt printer', 'jobId': str(uuid.uuid4()), **extra}


class FakePrinters:
    def __init__(self):
        self.jobs = []
        self.fail = False

    def names(self):
        return ['Receipt printer']

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
        self.assertEqual(body, {'version':4,'app':'MenuzQR Print'})

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

    def test_feed_is_bounded_and_independent_of_line_spacing(self):
        for invalid in (-1, 31, 1.5, True, '3'):
            self.assertEqual(self.request('POST', '/print', bitmap(feedMm=invalid))[0], 400)
        self.assertTrue(bridge.raster_commands(bitmap(cut=True, feedMm=0)).endswith(b'\x1dVA\x00'))
        self.assertTrue(bridge.raster_commands(bitmap(cut=False, feedMm=30)).endswith(b'\x1bJ\xf0'))
        self.assertEqual(len(bridge.raster_commands(bitmap(cut=False, feedMm=0))) + 3, len(bridge.raster_commands(bitmap(cut=False, feedMm=3))))

    def test_raster_dimensions_strips_and_cut(self):
        for width in (384, 512, 576):
            body = bitmap(width, 129, cut=True)
            data = bridge.raster_commands(body)
            start = data.index(bytes([29, 118, 48, 0]))
            decoded = bytearray()
            offset = start
            while data[offset:offset+4] == bytes([29, 118, 48, 0]):
                stride = int.from_bytes(data[offset+4:offset+6], 'little')
                rows = int.from_bytes(data[offset+6:offset+8], 'little')
                self.assertEqual(stride, width // 8)
                self.assertLessEqual(rows, 24)
                decoded.extend(data[offset+8:offset+8+stride*rows])
                offset += 8+stride*rows
            self.assertEqual(bytes(decoded), base64.b64decode(body['raster']))
            self.assertEqual(data[offset:], b'\x1dVA\x18')

    def test_column_mode_preserves_pixels_without_rotation_or_extra_feeds(self):
        for width in (384, 512, 576):
            height = 49
            raster = bytearray(width // 8 * height)
            pixels = [(0,0),(7,1),(8,7),(width-1,23),(19,24),(37,48)]
            for x,y in pixels:
                raster[y*(width//8)+x//8] |= 128 >> (x%8)
            data = bridge.raster_commands(bitmap(width,height,raster=base64.b64encode(raster).decode(),encoding='column',feedMm=0,cut=False))
            offset = data.index(b'\x1b3\x18')+3
            decoded = []
            for top in range(0,height,24):
                self.assertEqual(data[offset:offset+5], bytes([27,42,33,width & 255,width >> 8]))
                offset += 5
                for x in range(width):
                    for block in range(3):
                        value=data[offset]; offset+=1
                        for bit in range(8):
                            if value & (128 >> bit): decoded.append((x,top+block*8+bit))
                self.assertEqual(data[offset],10); offset+=1
            self.assertEqual(set(decoded),set(pixels))
            self.assertEqual(data[offset:],b'\x1b2')

    def test_short_test_has_hard_height_limit_and_no_extra_feed(self):
        self.assertEqual(self.request('POST','/print',bitmap(height=161,testPrint=True))[0],400)
        for encoding in ('raster','column'):
            data=bridge.raster_commands(bitmap(height=72,testPrint=True,feedMm=30,encoding=encoding,cut=True))
            self.assertTrue(data.endswith(b'\x1dVA\x00'))
        self.assertEqual(self.printers.jobs,[])

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
