# Thermal receipt printing

The receipt path does not generate a PDF. The browser renders Arabic and English
to a monochrome bitmap. Browser-dialog printing remains driver-dependent: page
size, scaling and orientation can override the CSS and add excess paper.

The recommended path is the included Windows Python bridge, version 2. It sends
RAW ESC/POS raster commands through the installed Windows printer queue. The web
app stays in Next.js; no printer connection is made from the hosted server.

## Cashier setup

1. Install the manufacturer's Windows printer driver and Python 3.10 or newer.
2. Download `/menuzqr-print-bridge.py` from printer settings on the website. Close
   an older bridge before running `py menuzqr-print-bridge.py`. The existing
   pairing code is retained. Keep the bridge running while using POS.
3. Open **Thermal printer setup**, choose **Direct**, paste the pairing code and
   connect. Allow local network access if the browser asks.
4. Explicitly select the installed ESC/POS thermal printer, not a PDF or office
   printer. USB, Bluetooth and network connections work through the Windows queue
   provided that the printer and its driver accept RAW ESC/POS raster commands.
5. Select the roll width: 58 mm uses 384 dots; 80 mm offers 576 or 512 dots. Check
   the printer specification for the printable width. These profiles target
   203 dpi printers implementing `GS v 0` raster printing.
6. Start with 3 mm extra feed and enable cutting only on a printer with a cutter.
   With cutting enabled, the printer also feeds to its physical cutting position.
   With cutting disabled, increase the feed if needed to reach the tear bar.
7. Print the test receipt, then a short and a long real receipt. Confirm Arabic,
   totals, right/left edges and the last line before relying on it for sales.

Settings persist per business in this browser on this computer. Existing browser
mode preferences remain unchanged; switch them to Direct to use the fixed path.
New settings default to Direct and ask for setup instead of silently opening the
browser dialog. Orders are saved even when setup or printing is incomplete.

## Changes in version 2

- Explicit standard roll mode and printable width, without page rotation/scaling.
- Feed in millimetres rather than three fixed blank lines; feed-and-cut command
  accounts for the physical distance between the print head and cutter.
- 512-dot support for narrower 80 mm print heads.
- Readable stacked item rows on 58 mm receipts; 80 mm retains the five-column table.
- Client checks the bridge version before sending and requests an update when
  an older version is running. No automatic browser fallback on bridge failure.
- Browser fallback uses the same physical 203 dpi bitmap dimensions. It still
  requires portrait, 100% scale, the correct roll size and disabled headers/footers
  in the driver/dialog; browser CSS cannot guarantee the paper length.

The bridge acknowledges Windows spooler acceptance, not physical output. After
an uncertain response, check the printer before using the explicit browser
fallback. Retrying the direct request reuses its job ID to prevent duplicate
enqueueing within the running bridge process.

## Verification

`npm run typecheck`

`python -m unittest discover -s tests -p test_print_bridge.py`

`node tests/pos-print-browser.cjs` (requires esbuild, Playwright and
@sparticuz/chromium; supports PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE overrides).

Automated tests validate raster dimensions, protocol framing, feed/cut, setup,
old-bridge rejection, checkout failures and retry behavior. Physical output and
model-specific command compatibility must be checked on the cashier's printer.
