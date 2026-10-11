# MenuzQR Print 5: native Windows driver printing

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
and install MenuzQR Print once. Python and runtime libraries are bundled. Setup
starts the service and registers startup. The site pairs automatically; a ready
printer prints without setup dialogs. A small Test print button sends two lines.

Modern: https://github.com/tranzillofficial/menuzqr/releases/download/print-v5/MenuzQR-Print-Setup.exe
Windows 7 SP1: https://github.com/tranzillofficial/menuzqr/releases/download/print-win7-v5/MenuzQR-Print-Win7-Setup.exe

Version 5 must replace the old service. Cancel old stuck print jobs before testing.
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

Python tests cover page geometry, DEVMODE/private data, portrait and one-copy
settings, top-down bitmap rendering, abort behavior, duplicate jobs, recovery from
rejected sizes, origin restrictions and pairing. Browser tests cover all POS flows,
small tests, old-service rejection and absence of browser/PDF dialogs. Windows
workflows run service tests and installation/startup/uninstall on Server 2022.
Actual Windows 7 hardware, printer-driver custom sizes and physical cutting still
require a test on the customer's printer. Installers are not Authenticode signed.
