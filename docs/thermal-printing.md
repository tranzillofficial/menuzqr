# MenuzQR Print 6: standalone native C++ Windows printing

Order receipts from POS, InvoiceView and printer settings share one renderer and
one local service. QR labels, report printing and exported archive HTML are
separate document features and do not enter the thermal receipt pipeline.

## Document pipeline

1. The website shapes Arabic and renders a compact bold monochrome receipt.
2. A versioned `windows-gdi-v1` request carries bitmap dimensions and roll width.
3. The service validates the document and obtains the installed driver DEVMODE,
   retaining its private settings. It requests portrait, 100% scale, one copy,
   simplex, roll width 58/80 mm, and a content-derived page length.
4. DocumentProperties negotiates the settings. CreateDC/GetDeviceCaps validate
   the physical page and printable bounds BEFORE any spooler job is started.
   A4, rotated, excessively long or clipping pages are rejected without printing.
5. StartDoc/StartPage/StretchDIBits/EndPage/EndDoc submit exactly one page. Errors
   abort that document. The printer manufacturer driver controls transport/cutting.

The former RAW ESC/POS encoders, image-mode/feed/cut switches and browser receipt
printing have been removed. The renderer remains printer-code-page independent.
No global Windows defaults are overwritten; document settings are per print job.

## Installation

Use the manufacturer graphics driver, not Generic/Text Only. Connect the printer
and install MenuzQR Print once. The active service is `native-print/MenuzQRPrint.cpp`,
compiled as an x86 Win32 executable with `/MT` using Visual Studio 2022. There is
no Python or .NET runtime on the client. Windows 7 requires SP1; the same binary
runs on x64 Windows. WinHTTP uses TLS 1.2 with normal certificate validation.
Incorrect system time or missing Windows certificate updates produce a visible
pairing error; certificate verification is never disabled.

Installer: https://github.com/tranzillofficial/menuzqr/releases/download/print-v6/MenuzQR-Print-Setup.exe

Setup stops only the previous bridge executables inside the install folder,
replaces the startup entry, and opens the status window. Sign-in starts minimized
to the notification area. Opening the shortcut again shows the existing window;
closing the window keeps printing running; Exit program stops it. Startup errors
are shown in a Windows message box. The health URL also works when opened directly.
The site never prints automatically on installation, pairing or reconnection.

The existing pairing key and SQLite print journal are retained across upgrades.
Uncertain and completed jobs are not automatically replayed, including jobs
submitted by the previous Python service. No receipt content is stored.

Blank rows are trimmed at both rendering and service boundaries. Page length is
content height plus 2 mm, with a 15 mm minimum. Driver output exceeding the
requested length by more than 5 mm is rejected before submission. Cutter/head
mechanical margins remain model-dependent. One two-line test is sent per click.

The driver must support custom continuous-roll sizes; unsupported sizes produce
an error rather than wasting paper. Cutter behavior is model-specific: enable cut
at document end in the driver if available. Existing private driver settings are
preserved. The installer cannot guess a manufacturer's cutter configuration.

## Transport and reliability

The service binds only loopback. Signed, expiring website tickets authorize pairing;
origin-bound tokens protect discovery and printing. A persistent SQLite journal
contains IDs and outcomes only. It reserves IDs after page validation, before
spooling. Successful or uncertain sends are never automatically repeated, including
across service restarts. Windows acceptance is not proof of physical paper output.

## Verification

Legacy Python tests remain as regression references for the previous service;
they do not validate the C++ executable. Browser tests cover all POS flows,
small tests, old-service rejection and absence of browser/PDF dialogs. Windows
workflows run service tests and installation/startup/uninstall on Server 2022.
Actual Windows 7 hardware, printer-driver custom sizes and physical cutting still
require a test on the customer's printer. Installers are not Authenticode signed.

## Native verification

`--self-test` covers origin restrictions, scoped tokens, virtual-printer selection,
bitmap trimming, test-size limits and uncertain/completed job journal states.
The Windows workflow compiles the executable, checks it has no external language
runtime DLL dependency, exercises installation, startup, authorized discovery,
invalid token/origin/print rejection, in-place upgrade and uninstall. It does not
send physical print jobs. Windows 7 hardware, its installed driver and physical
paper/cutting still require on-device validation.
