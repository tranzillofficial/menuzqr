"""Transport and bitmap tests; no physical printer or Windows required."""
import base64
import http.client
from http.server import HTTPServer
import importlib.util
import json
from pathlib import Path
import threading
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
        self.server = HTTPServer(('127.0.0.1', 0), bridge.make_handler(self.printers, 'test-token', {'https://menuzqr.shop'}))
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
            commands = bridge.raster_commands(body)
            stride = width // 8
            prefix = b'\x1b@\x1bS\x1ba\x00\x1dL\x00\x00' + bytes([29, 87, width & 255, width >> 8]) + b'\x1dP\xcb\xcb'
            self.assertEqual(commands[:len(prefix) + 8], prefix + bytes([29, 118, 48, 0, stride, 0, 128, 0]))
            offset = len(prefix) + 8 + stride * 128
            self.assertEqual(commands[offset:offset + 8], bytes([29, 118, 48, 0, stride, 0, 1, 0]))
            self.assertTrue(commands.endswith(b'\x1dVA\x18'))
            self.assertTrue(bridge.raster_commands(bitmap(width, cut=False)).endswith(b'\x1bJ\x18'))


if __name__ == '__main__':
    unittest.main()
