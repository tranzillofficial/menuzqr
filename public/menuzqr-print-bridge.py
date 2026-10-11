#!/usr/bin/env python3
"""MenuzQR Windows driver printing service. Bundled runtime; no manual Python setup."""
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
import sqlite3
from contextlib import closing, contextmanager
import struct
import math
import uuid
import hashlib
import re
import sys
from urllib.parse import urlparse
from urllib.request import Request, urlopen

MAX_BODY = 2_000_000
BRIDGE_VERSION = 5


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


def receipt_bitmap(body):
    if body.get('protocol') != 'windows-gdi-v1':
        raise ValueError('Update the website and MenuzQR Print together.')
    width, height, paper = body.get('width'), body.get('height'), body.get('paperMm')
    if type(width) is not int or width not in (384, 512, 576) or type(height) is not int or not 1 <= height <= 20000:
        raise ValueError('Invalid receipt dimensions.')
    if type(paper) is not int or paper not in (58, 80) or (paper == 58 and width != 384):
        raise ValueError('Invalid roll width.')
    if body.get('testPrint') is True and height > 160:
        raise ValueError('Test receipt exceeds 20 mm content limit.')
    raster = base64.b64decode(body.get('raster', ''), validate=True)
    if len(raster) != width // 8 * height:
        raise ValueError('Invalid receipt bitmap.')
    return {'width': width, 'height': height, 'paper': paper,
            'length': max(25, math.ceil(height * 25.4 / 203 + 4)), 'raster': raster}


def configure_devmode(buffer, paper, length):
    # DEVMODEW public offsets are fixed on both x86 and x64; retain the entire
    # driver-specific tail returned by DocumentProperties (never fabricate it).
    if len(buffer) < 220 or struct.unpack_from('<H', buffer, 68)[0] < 220:
        raise ValueError('Printer driver returned an invalid DEVMODE.')
    fields = struct.unpack_from('<I', buffer, 72)[0]
    fields = (fields & ~0x10000) | 0x1 | 0x2 | 0x4 | 0x8 | 0x10 | 0x100 | 0x1000
    struct.pack_into('<I', buffer, 72, fields)
    struct.pack_into('<hhhhhh', buffer, 76, 1, 0, length * 10, paper * 10, 100, 1)
    struct.pack_into('<h', buffer, 94, 1)  # simplex; exactly one copy


def page_geometry(job, caps):
    # GetDeviceCaps: LOGPIXELSX/Y, PHYSICALWIDTH/HEIGHT, HORZRES/VERTRES.
    dx, dy, pw, ph, available_w, available_h = caps
    if min(caps) <= 0:
        raise ValueError('Printer driver did not report valid page dimensions.')
    actual_w, actual_h = pw * 25.4 / dx, ph * 25.4 / dy
    if abs(actual_w - job['paper']) > 3 or not job['length'] - 3 <= actual_h <= job['length'] + 15:
        raise ValueError('Printer driver rejected the receipt paper size. Install the manufacturer thermal driver and choose continuous roll paper.')
    # Preserve aspect ratio if the physical head is narrower than expected.
    scale = min(dx / 203, available_w / job['width'])
    w = round(job['width'] * scale)
    h = round(job['height'] * scale * dy / dx)
    if h > available_h or w < job['width'] * dx / 203 * 0.8:
        raise ValueError('Printer margins would clip the receipt. Check the roll width in the driver.')
    return w, h


class WindowsPrinters:
    def __init__(self):
        if os.name != 'nt':
            raise RuntimeError('MenuzQR Print requires Windows.')
        self.api = ctypes.WinDLL('winspool.drv', use_last_error=True)
        self.gdi = ctypes.WinDLL('gdi32.dll', use_last_error=True)
        ptr, integer, text = ctypes.c_void_p, ctypes.c_int, wintypes.LPCWSTR
        signatures = [
            (self.api, 'EnumPrintersW', [wintypes.DWORD,text,wintypes.DWORD,ptr,wintypes.DWORD,ptr,ptr],wintypes.BOOL),
            (self.api, 'OpenPrinterW', [text,ptr,ptr],wintypes.BOOL),
            (self.api, 'ClosePrinter', [ptr],wintypes.BOOL),
            (self.api, 'DocumentPropertiesW', [ptr,ptr,text,ptr,ptr,wintypes.DWORD],wintypes.LONG),
            (self.gdi, 'CreateDCW', [text,text,text,ptr],ptr),
            (self.gdi, 'DeleteDC', [ptr],wintypes.BOOL),
            (self.gdi, 'GetDeviceCaps', [ptr,integer],integer),
            (self.gdi, 'StartDocW', [ptr,ptr],integer),
            (self.gdi, 'StartPage', [ptr],integer),
            (self.gdi, 'EndPage', [ptr],integer),
            (self.gdi, 'EndDoc', [ptr],integer),
            (self.gdi, 'AbortDoc', [ptr],integer),
            (self.gdi, 'StretchDIBits', [ptr]+[integer]*8+[ptr,ptr,wintypes.UINT,wintypes.DWORD],integer),
        ]
        for dll, name, args, result in signatures:
            fn = getattr(dll,name); fn.argtypes=args; fn.restype=result

    def names(self):
        class Info(ctypes.Structure):
            _fields_ = [('name',wintypes.LPWSTR),('server',wintypes.LPWSTR),('flags',wintypes.DWORD)]
        needed, count = wintypes.DWORD(), wintypes.DWORD()
        self.api.EnumPrintersW(6,None,4,None,0,ctypes.byref(needed),ctypes.byref(count))
        if not needed.value:
            return []
        buffer=ctypes.create_string_buffer(needed.value)
        if not self.api.EnumPrintersW(6,None,4,buffer,needed.value,ctypes.byref(needed),ctypes.byref(count)):
            raise ctypes.WinError(ctypes.get_last_error())
        items=ctypes.cast(buffer,ctypes.POINTER(Info))
        return sorted({items[i].name for i in range(count.value)
                       if items[i].name and not re.search(r'pdf|xps|onenote|fax',items[i].name,re.I)})

    @contextmanager
    def prepare(self, name, job):
        if name not in self.names():
            raise ValueError('Printer is not installed or is a virtual PDF printer.')
        handle=wintypes.HANDLE(); dc=None
        if not self.api.OpenPrinterW(name,ctypes.byref(handle),None):
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            size=self.api.DocumentPropertiesW(None,handle,name,None,None,0)
            if size < 220: raise ValueError('Install the manufacturer graphics printer driver; Generic/Text Only is not supported.')
            dev=ctypes.create_string_buffer(size)
            if self.api.DocumentPropertiesW(None,handle,name,dev,None,2) != 1:
                raise ValueError('Could not read printer preferences.')
            configure_devmode(dev,job['paper'],job['length'])
            if self.api.DocumentPropertiesW(None,handle,name,dev,dev,10) != 1:
                raise ValueError('Printer rejected the custom receipt size.')
            if struct.unpack_from('<h',dev,76)[0] != 1 or struct.unpack_from('<h',dev,86)[0] != 1:
                raise ValueError('Printer driver did not accept portrait orientation and one copy.')
            dc=self.gdi.CreateDCW('WINSPOOL',name,None,dev)
            if not dc: raise ctypes.WinError(ctypes.get_last_error())
            dims=page_geometry(job,[self.gdi.GetDeviceCaps(dc,c) for c in (88,90,110,111,8,10)])
            yield dc, dims, job
        finally:
            if dc: self.gdi.DeleteDC(dc)
            self.api.ClosePrinter(handle)

    def write(self, name, prepared):
        dc, (w,h), job=prepared
        class DocInfo(ctypes.Structure):
            _fields_=[('size',ctypes.c_int),('name',wintypes.LPCWSTR),('output',wintypes.LPCWSTR),('datatype',wintypes.LPCWSTR),('flags',wintypes.DWORD)]
        doc=DocInfo(ctypes.sizeof(DocInfo),'MenuzQR receipt',None,None,0)
        started=False
        try:
            if self.gdi.StartDocW(dc,ctypes.byref(doc)) <= 0: raise RuntimeError('Windows could not create the print job.')
            started=True
            if self.gdi.StartPage(dc) <= 0: raise RuntimeError('Windows could not start the receipt page.')
            # Top-down 1-bit DIB: white=0, black=1. No printer-language commands.
            header=struct.pack('<IiiHHIIiiII',40,job['width'],-job['height'],1,1,0,len(job['raster']),0,0,2,2)
            info=ctypes.create_string_buffer(header+struct.pack('<II',0x00ffffff,0))
            pixels=ctypes.create_string_buffer(job['raster'])
            result=self.gdi.StretchDIBits(dc,0,0,w,h,0,0,job['width'],job['height'],pixels,info,0,0x00CC0020)
            if result in (0,-1): raise RuntimeError('Printer driver could not render the receipt.')
            if self.gdi.EndPage(dc) <= 0 or self.gdi.EndDoc(dc) <= 0: raise RuntimeError('Windows could not complete the print job.')
            started=False
        finally:
            if started: self.gdi.AbortDoc(dc)


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


class JobStore:
    """Persist the uncertain state BEFORE handing a job to Windows."""
    def __init__(self, path):
        self.path = str(path)
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, done INTEGER NOT NULL)')

    def get(self, key):
        with closing(sqlite3.connect(self.path)) as db, db:
            row = db.execute('SELECT done FROM jobs WHERE id=?', (key,)).fetchone()
            return None if row is None else bool(row[0])

    def put(self, key, done):
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute('INSERT OR REPLACE INTO jobs(id,done) VALUES (?,?)', (key, int(done)))


def make_handler(printers, token, origins, ticket_verifier=verify_ticket, job_store=None):
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
                bitmap = receipt_bitmap(body)
                previous = job_store.get(job_id) if job_store else jobs.get(job_id)
                if previous is not None:
                    self.reply(200 if previous else 409, {'ok': previous, 'duplicate': True, 'error': 'Job outcome uncertain. Check the printer before reprinting.'})
                    return
                if len(jobs) >= 10000:
                    raise ValueError('Restart the bridge before sending more jobs.')
                # Remember ambiguous failures too: never blindly resubmit a job
                # that may have partially reached the Windows spooler.
                if not isinstance(body.get('printer'), str) or body['printer'] not in printers.names():
                    raise ValueError('Printer is not installed.')
                # Validate the driver page BEFORE reserving the ID or starting
                # a spooler job. Rejected paper settings never consume paper.
                with printers.prepare(body['printer'], bitmap) as prepared:
                    if job_store: job_store.put(job_id, False)
                    else: jobs[job_id] = False
                    printers.write(body['printer'], prepared)
                    if job_store: job_store.put(job_id, True)
                    else: jobs[job_id] = True
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
    folder = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'MenuzQR'
    store = JobStore(folder / 'print-jobs.sqlite3')
    server = HTTPServer(('127.0.0.1', 18191), make_handler(printers, token, origins, job_store=store))
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
