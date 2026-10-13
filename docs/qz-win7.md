# Windows 7 SP1 / x86 cashier printing

The POS uses QZ WebSocket printing. Current QZ installers are not suitable for 32-bit Windows; the legacy option is an explicit separate download, not an OS detection heuristic.

`installer/qz-win7-x86.iss` bundles the original QZ 2.1.6+3 installer and BellSoft Liberica Java 8u502+9 Full x86. The Java runtime is private to the QZ application directory; the wrapper does not change the system JAVA_HOME. It runs QZ's original installation and certificate setup. No Python or separately installed Java is required. Keep the manufacturer's Windows printer driver installed.

The GitHub workflow checks both payload SHA-256 hashes, checks that Java is 32-bit and includes JavaFX, builds the offline installer, installs it with an invalid system JAVA_HOME, and checks a certificate-validated secure WebSocket getVersion response, the private Java process, and startup registration before publishing. This runs on Windows Server 2022, **not** Windows 7 or a physical thermal printer.

Manual acceptance on the cashier remains necessary: install on Windows 7 SP1 x86, approve QZ site access, select the installed Xprinter queue and 80 mm paper, then use Small test. Check the printed content and feed length. Pixel receipts use content-derived page height; printer-driver roll size and cutting settings can still affect physical feed.

QZ 2.1 is a legacy, unsupported compatibility option. Do not weaken TLS or certificate checks to address connection failures. Payload versions, hashes and source/license links are recorded in the workflow and installer notice. Both upstream payloads remain unmodified, including their license files.
