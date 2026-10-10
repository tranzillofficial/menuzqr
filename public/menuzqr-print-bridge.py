#!/usr/bin/env python3
"""MenuzQR Windows ESC/POS bridge. Python 3.10+, no pip packages required.

Install the thermal printer's Windows driver, run this file and paste the
pairing code into POS > Thermal printer setup. Keep this process running.
Only installed ESC/POS receipt printers are supported (not PDF printers).
"""
import argparse
import base64
import ctypes
from ctypes import wintypes
import hmac
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import secrets
import uuid
import hashlib
import re
import sys
from urllib.parse import urlparse
from urllib.request import Request, urlopen

MAX_BODY = 2_000_000
BRIDGE_VERSION = 3


def verify_ticket(ticket, origin):
    if not isinstance(ticket, str) or len(ticket) > 2048:
        return False
    request = Request('https://menuzqr.shop/api/print-pair/verify',
                      data=json.dumps({'ticket': ticket, 'origin': origin}).encode(),
                      headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urlopen(request, timeout=8) as response:
            return response.status == 200 and json.loads(response.read(4096)).get('ok') is True
    except Exception:
        return False


def automatic_printer(names):
    # A single recognized receipt printer is safe to suggest. Never select an
    # office, PDF or label printer merely because Windows marks it as default.
    candidates = [name for name in names if re.search(r'thermal|receipt|esc.?pos|pos[- _]?(58|80)|tm[- _][tmpu]|xprinter|rongta|rp[- _]?(58|80)', name, re.I)
                  and not re.search(r'pdf|xps|onenote|fax|label|zebra', name, re.I)]
    return candidates[0] if len(candidates) == 1 else None


class WindowsPrinters:
    def __init__(self):
        if os.name != 'nt':
            raise RuntimeError('This bridge requires Windows and an installed ESC/POS printer.')
        self.api = ctypes.WinDLL('winspool.drv', use_last_error=True)
        api = self.api
        api.EnumPrintersW.argtypes = [wintypes.DWORD, wintypes.LPWSTR, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD), ctypes.POINTER(wintypes.DWORD)]
        api.EnumPrintersW.restype = wintypes.BOOL
        api.OpenPrinterW.argtypes = [wintypes.LPWSTR, ctypes.POINTER(wintypes.HANDLE), ctypes.c_void_p]
        api.OpenPrinterW.restype = wintypes.BOOL
        api.StartDocPrinterW.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.c_void_p]
        api.StartDocPrinterW.restype = wintypes.DWORD
        for name in ('StartPagePrinter', 'EndPagePrinter', 'EndDocPrinter', 'ClosePrinter', 'AbortPrinter'):
            function = getattr(api, name)
            function.argtypes = [wintypes.HANDLE]
            function.restype = wintypes.BOOL
        api.WritePrinter.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
        api.WritePrinter.restype = wintypes.BOOL

    def names(self):
        class PrinterInfo(ctypes.Structure):
            _fields_ = [('pPrinterName', wintypes.LPWSTR), ('pServerName', wintypes.LPWSTR), ('Attributes', wintypes.DWORD)]
        needed, count = wintypes.DWORD(), wintypes.DWORD()
        self.api.EnumPrintersW(6, None, 4, None, 0, ctypes.byref(needed), ctypes.byref(count))
        if not needed.value:
            error = ctypes.get_last_error()
            if error not in (0, 122):
                raise ctypes.WinError(error)
            return []
        buffer = ctypes.create_string_buffer(needed.value)
        if not self.api.EnumPrintersW(6, None, 4, buffer, needed.value, ctypes.byref(needed), ctypes.byref(count)):
            raise ctypes.WinError(ctypes.get_last_error())
        items = ctypes.cast(buffer, ctypes.POINTER(PrinterInfo))
        return sorted({items[i].pPrinterName for i in range(count.value) if items[i].pPrinterName})

    def write(self, name, data):
        if name not in self.names():
            raise ValueError('Printer is not installed. Reconnect and select a printer.')
        class DocInfo(ctypes.Structure):
            _fields_ = [('pDocName', wintypes.LPWSTR), ('pOutputFile', wintypes.LPWSTR), ('pDatatype', wintypes.LPWSTR)]
        handle = wintypes.HANDLE()
        if not self.api.OpenPrinterW(name, ctypes.byref(handle), None):
            raise ctypes.WinError(ctypes.get_last_error())
        started = False
        try:
            doc = DocInfo('MenuzQR receipt', None, 'RAW')
            if not self.api.StartDocPrinterW(handle, 1, ctypes.byref(doc)):
                raise ctypes.WinError(ctypes.get_last_error())
            started = True
            if not self.api.StartPagePrinter(handle):
                raise ctypes.WinError(ctypes.get_last_error())
            written = wintypes.DWORD()
            buffer = ctypes.create_string_buffer(data)
            if not self.api.WritePrinter(handle, buffer, len(data), ctypes.byref(written)) or written.value != len(data):
                raise RuntimeError('Windows could not accept the complete receipt.')
            if not self.api.EndPagePrinter(handle) or not self.api.EndDocPrinter(handle):
                raise RuntimeError('Windows could not finish the print job.')
            started = False
        finally:
            if started:
                self.api.AbortPrinter(handle)
            self.api.ClosePrinter(handle)


def raster_commands(body):
    width, height = body.get('width'), body.get('height')
    if type(width) is not int or width not in (384, 512, 576) or type(height) is not int or not 1 <= height <= 20000:
        raise ValueError('Invalid receipt dimensions.')
    feed_mm = body.get('feedMm', 3)
    if type(feed_mm) is not int or not 0 <= feed_mm <= 30:
        raise ValueError('Feed must be a whole number between 0 and 30 mm.')
    raster = base64.b64decode(body.get('raster', ''), validate=True)
    row_bytes = width // 8
    if len(raster) != row_bytes * height:
        raise ValueError('Invalid receipt bitmap.')
    # Reset and explicitly use standard (continuous roll) mode. No PDF, page
    # dimensions, Windows orientation or scaling is involved in this RAW job.
    commands = bytearray(b'\x1b@\x1bS\x1ba\x00\x1dL\x00\x00')
    commands.extend(bytes([0x1d, 0x57, width & 255, width >> 8]))
    commands.extend(b'\x1dP\xcb\xcb')  # 203 dpi motion units
    # Small raster strips reduce pressure on inexpensive printers' buffers.
    # GS v 0 is widely implemented by generic ESC/POS receipt printers.
    for offset in range(0, height, 128):
        rows = min(128, height - offset)
        commands.extend(bytes([0x1d, 0x76, 0x30, 0, row_bytes & 255, row_bytes >> 8, rows & 255, rows >> 8]))
        commands.extend(raster[offset * row_bytes:(offset + rows) * row_bytes])
    feed_dots = round(feed_mm * 203 / 25.4)
    if body.get('cut') is True:
        # Feed to the cutter plus the chosen margin; the head-to-cutter distance
        # is mechanical and cannot be eliminated by shortening a document.
        commands.extend(bytes([0x1d, 0x56, 65, feed_dots]))
    elif feed_dots:
        commands.extend(bytes([0x1b, 0x4a, feed_dots]))
    return bytes(commands)


def pairing_token():
    folder = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'MenuzQR'
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / 'print-pairing-code.txt'
    if path.exists():
        return path.read_text(encoding='utf-8').strip()
    token = secrets.token_urlsafe(32)
    path.write_text(token, encoding='utf-8')
    try:
        path.chmod(0o600)
    except OSError:
        pass
    return token


def make_handler(printers, token, origins, ticket_verifier=verify_ticket):
    jobs = {}

    def scoped_token(origin):
        return hmac.new(token.encode(), ('origin:'+origin).encode(), hashlib.sha256).hexdigest()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # Never log the pairing code or receipt contents.

        def safe_origin(self):
            origin = self.headers.get('Origin', '')
            parsed = urlparse(origin)
            return self.headers.get('Host') in ('127.0.0.1:18191', 'localhost:18191') and (origin in origins or (parsed.scheme == 'https' and bool(parsed.hostname) and parsed.path == '' and not parsed.query and not parsed.fragment and not parsed.username and not parsed.password))

        def valid_origin(self):
            if not self.safe_origin():
                return False
            origin = self.headers.get('Origin', '')
            return origin in origins or hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer '+scoped_token(origin))

        def reply(self, status, body):
            self.send_response(status)
            if self.safe_origin() and (self.valid_origin() or self.path in ('/pair', '/health') or self.command == 'OPTIONS'):
                self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
                self.send_header('Vary', 'Origin')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
                self.send_header('Access-Control-Allow-Private-Network', 'true')
            encoded = json.dumps(body).encode('utf-8')
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def authorized(self):
            if not self.valid_origin():
                self.reply(403, {'error': 'This website is not allowed.'})
                return False
            origin = self.headers.get('Origin', '')
            auth = self.headers.get('Authorization', '')
            if not (hmac.compare_digest(auth, 'Bearer '+scoped_token(origin)) or (origin in origins and hmac.compare_digest(auth, 'Bearer '+token))):
                self.reply(401, {'error': 'Invalid pairing code.'})
                return False
            return True

        def do_OPTIONS(self):
            self.reply(200 if self.safe_origin() else 403, {})

        def do_GET(self):
            if self.path == '/health':
                self.reply(200 if self.safe_origin() else 403, {'version': BRIDGE_VERSION, 'app': 'MenuzQR Print'})
                return
            if not self.authorized():
                return
            if self.path != '/printers':
                self.reply(404, {'error': 'Unknown endpoint.'})
                return
            try:
                names = printers.names()
                self.reply(200, {'printers': names, 'version': BRIDGE_VERSION, 'suggestedPrinter': automatic_printer(names)})
            except Exception as error:
                self.reply(503, {'error': str(error)})

        def do_POST(self):
            if self.path == '/pair':
                if not self.safe_origin():
                    self.reply(403, {'error': 'Invalid website origin.'})
                    return
                try:
                    length = int(self.headers.get('Content-Length', '0'))
                    if not 0 < length <= 4096 or self.headers.get('Content-Type') != 'application/json':
                        raise ValueError('Invalid pairing request.')
                    body = json.loads(self.rfile.read(length))
                    origin = self.headers.get('Origin', '')
                    if not ticket_verifier(body.get('ticket'), origin):
                        self.reply(403, {'error': 'Sign in to MenuzQR and try connecting again.'})
                        return
                    self.reply(200, {'token': scoped_token(origin), 'version': BRIDGE_VERSION})
                except (ValueError, TypeError, AttributeError):
                    self.reply(400, {'error': 'Invalid pairing request.'})
                return
            if not self.authorized():
                return
            if self.path != '/print':
                self.reply(404, {'error': 'Unknown endpoint.'})
                return
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= MAX_BODY:
                    raise ValueError('Receipt is too large or missing.')
                if self.headers.get('Content-Type') != 'application/json':
                    raise ValueError('JSON required.')
                body = json.loads(self.rfile.read(length))
                job_id = str(uuid.UUID(body['jobId']))
                commands = raster_commands(body)
                if job_id in jobs:
                    self.reply(200 if jobs[job_id] else 409, {'ok': jobs[job_id], 'error': 'Job outcome uncertain. Check the printer before reprinting.'})
                    return
                if len(jobs) >= 10000:
                    raise ValueError('Restart the bridge before sending more jobs.')
                # Remember ambiguous failures too: never blindly resubmit a job
                # that may have partially reached the Windows spooler.
                if not isinstance(body.get('printer'), str) or body['printer'] not in printers.names():
                    raise ValueError('Printer is not installed.')
                jobs[job_id] = False
                printers.write(body['printer'], commands)
                jobs[job_id] = True
            except (ValueError, KeyError, TypeError) as error:
                self.reply(400, {'error': str(error)})
                return
            except Exception as error:
                self.reply(503, {'error': str(error)})
                return
            self.reply(200, {'ok': True})

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin', action='append', default=[], help='Additional exact website origin, e.g. http://localhost:3000')
    args = parser.parse_args()
    printers = WindowsPrinters()
    token = pairing_token()
    origins = {'https://menuzqr.shop', 'https://www.menuzqr.shop', *args.origin}
    server = HTTPServer(('127.0.0.1', 18191), make_handler(printers, token, origins))
    server.timeout = 10
    # Bound request reads so stalled clients cannot block the cashier forever.
    original_get_request = server.get_request
    def get_request():
        connection, address = original_get_request()
        connection.settimeout(10)
        return connection, address
    server.get_request = get_request
    if sys.stdout is not None:
        print(f'MenuzQR print bridge v{BRIDGE_VERSION} is ready. Keep this window open.\nPairing code: ' + token, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        if sys.stderr is not None:
            print('Could not start MenuzQR print bridge: ' + str(error), file=sys.stderr)
        # A second launch should quietly defer to the instance already running.
        elif getattr(error, 'winerror', None) != 10048:
            ctypes.windll.user32.MessageBoxW(None, 'Could not start MenuzQR Print. Restart Windows or reinstall MenuzQR Print.\n'+str(error), 'MenuzQR Print', 0x10)
        raise SystemExit(1)
