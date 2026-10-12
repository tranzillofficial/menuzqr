# Printing

The active integration is `qz-tray` over secure localhost WebSocket, managed by the React `ThermalPrinter` component. It replaces the custom Python/C++ HTTP bridge and pairing endpoints. Install QZ Tray on the computer connected to the printer, allow the site's connection, and select the Windows printer and 58/80 mm roll once. Settings are kept per browser and business.

Arabic is shaped by the browser and rasterized into a PNG. Pixel printing uses the installed printer driver, a portrait page sized to the actual rendered receipt, zero page margins and one copy. The short test prints two lines. A concurrency lock prevents concurrent checkout jobs and successful checkout requests are deduplicated in the mounted session. Manual print buttons explicitly allow another copy. Unknown responses are never retried automatically; the operator checks the spooler before retrying. Paper cutting is a driver/device setting.

Browser printing is an explicit alternative using `react-to-print` and the same receipt image. Its dialog depends on the browser and OS. Direct phone-to-USB/Bluetooth printing is not supplied by QZ's desktop integration. A phone can use its system print support; a shared QZ print server needs a separately secured LAN deployment.

Unsigned QZ requests can show confirmation dialogs. Suppressing these requires a trusted QZ certificate and server-side message signing. No private certificate or paid license is included. There is no claim of compatibility with every Windows release, browser or driver; verify the installed QZ/Java version on older Windows and run a physical test.

Run `tests/pos-print-browser.cjs` with Playwright available (optionally `PLAYWRIGHT_MODULE`, `CHROMIUM_MODULE` or `CHROMIUM_EXECUTABLE`). It mocks QZ and checkout accounting and never submits real receipts.
