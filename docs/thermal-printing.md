# Thermal receipt printing

MenuzQR Print 3 sends RAW ESC/POS raster commands to an installed Windows printer
queue. The browser shapes Arabic and English and renders a monochrome bitmap;
no PDF, document rotation or Windows page scaling is used in direct mode.

## Cashier setup

The first direct print checks for the local app. If setup is missing, an in-page
dialog offers **Download MenuzQR Print for Windows**. Download and run the installer,
then return to the open dialog. It detects the app, pairs automatically and offers
the saved receipt without creating another order. No Python installation, command
line, copied token or permanently open terminal is needed.

The per-user installer supports Windows 10/11 x64, bundles its runtime, starts the
app immediately and registers it for Windows sign-in. It can be removed through
Windows Apps. The Windows driver for the actual printer must already be installed;
manufacturer drivers cannot safely be guessed or universally bundled. Browser
local-network permission may require one user approval. This release is not
Authenticode signed, so Windows may show an unknown-publisher/SmartScreen prompt.
A trusted code-signing certificate is a separate distribution requirement.

One recognized receipt printer is selected automatically. If there are several,
or its name is not recognized, the cashier selects one once. PDF, office and label
printers are never chosen automatically. Settings are retained per business and
browser on this computer. Existing explicit browser-print preferences are retained;
choose Direct to use MenuzQR Print. The same setup UI serves all business accounts
and their active custom domains.

Use 58 mm/384 dots or 80 mm/576 dots (512 for narrower 80 mm heads). Recognized
POS-58 names select 58 mm automatically; other model profiles should be confirmed
with a test receipt. Default extra feed is 3 mm. Cutting is only supported by
printers with cutters. The physical head-to-cutter distance cannot be eliminated.
USB, Bluetooth and network queues work when their drivers accept RAW ESC/POS.
macOS, Linux and mobile devices do not run this Windows installer.

## Pairing and transport

The bridge binds only 127.0.0.1:18191 and validates Host and Origin. Health reports
no printer names or credentials. A signed-in owner/manager requests a two-minute
HMAC ticket from the website; the local app validates it against the fixed HTTPS
MenuzQR endpoint before issuing an origin-bound local token. A token for one
business domain is unusable from another origin. The signing secret remains on
the hosted server. Legacy manual tokens remain usable for explicitly allowed
origins; the normal UI no longer exposes a pairing-code field.

Orders are saved before printing. After an uncertain response, check the printer
before retrying. Repeated direct requests reuse a job ID, and the bridge remembers
accepted and uncertain jobs within its process lifetime. Spooler acknowledgement
is not proof that paper physically printed. There is no silent browser fallback.

## Installer build and release

`.github/workflows/print-installer.yml` builds on Windows using PyInstaller and
Inno Setup, tests install/startup/health/uninstall, then publishes the EXE and
SHA256SUMS.txt to the `print-v3` GitHub release. Website download:
https://github.com/tranzillofficial/menuzqr/releases/download/print-v3/MenuzQR-Print-Setup.exe

A new bridge build must pass the Windows smoke test before replacing the release
asset. The installer uses the same application ID and path for upgrades. Very old
manually launched Python bridges must be closed before the installed app can bind
the port; do not terminate unrelated Python processes automatically.

## Verification

- `npm run typecheck` and `npm run build`
- `python -m unittest discover -s tests -p test_print_bridge.py`
- `node --experimental-strip-types --test tests/print-pairing.test.mjs`
- `node tests/pos-print-browser.cjs` (optional esbuild, Playwright, Chromium tools)
- Windows workflow installation, startup and uninstall smoke test

Browser tests use real POS/printer components with mocked checkout and loopback
transport. They cover initial download, automatic pairing, installation recovery,
manual printer choice, legacy versions, lost print responses and browser fallback.
Physical output still requires a test on the customer's actual printer.

## Windows 7 compatibility installer

The separate Windows 7 SP1 installer supports x86 and x64. It embeds Python 3.8.10
and app-local Universal C Runtime DLLs beside the executable; users do not install
Python or a separate runtime. Setup registers automatic startup, and the website
performs the same automatic pairing and printer selection as the modern build.
The manufacturer ESC/POS printer driver must be installed.

`.github/workflows/print-installer-win7.yml` tests the embedded runtime and
installation/startup/uninstallation on Windows Server 2022 and publishes:
https://github.com/tranzillofficial/menuzqr/releases/download/print-win7-v3/MenuzQR-Print-Win7-Setup.exe

Physical Windows 7 and printer validation remains required. Windows 7 and this
legacy runtime are out of support; use the modern installer on Windows 10/11.
All receipt text is rendered bold, with wrapping measured using the bold font.

## Version 4 direct printing

The v4 installers are published under `print-v4` and `print-win7-v4`. POS checkout
and the small Test print button always use the local bridge. Old browser-mode
preferences migrate to direct printing, so neither path opens a PDF dialog.
A saved available printer prints without opening settings or requiring calibration
confirmation. Setup appears only when a connection or printer selection is needed;
the cashier may also open it explicitly. Reconnection alone never prints.

Compatibility mode uses ESC * 33 with correctly transposed 24-dot column bands
and explicit spacing. Raster mode uses small GS v 0 packets without extra LF.
Tests contain two lines, force extra feed to zero, and have a hard height limit.
Receipts preserve product, tax and customer details while omitting redundant paid,
zero-due and quantity summary rows. All text is bold, with full-width product names.

Local SQLite stores job outcomes before sending to Windows, preventing retries
from duplicating jobs across bridge restarts. It stores no receipt content.
Automated tests verify commands and UI behavior; actual paper output and cutter
travel still depend on the installed printer model.
