[Setup]
AppId={{F55891DE-94BB-4AD6-A10C-ED4CDF7AD91C}
AppName=MenuzQR Print
AppVersion=3.0.1
AppPublisher=MenuzQR
AppPublisherURL=https://menuzqr.shop
DefaultDirName={localappdata}\Programs\MenuzQR Print
DefaultGroupName=MenuzQR Print
PrivilegesRequired=lowest
; The official x86 embedded runtime runs on both x86 and x64 Windows 7 SP1.
MinVersion=6.1sp1
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=yes
CloseApplications=yes
RestartApplications=no
OutputDir=output
OutputBaseFilename=MenuzQR-Print-Win7-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\pythonw.exe

[Files]
Source: "..\dist\legacy\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "MenuzQRPrint"; ValueData: """{app}\pythonw.exe"" ""{app}\menuzqr-print-bridge.py"""; Flags: uninsdeletevalue

[Icons]
Name: "{group}\MenuzQR Print"; Filename: "{app}\pythonw.exe"; Parameters: """{app}\menuzqr-print-bridge.py"""
Name: "{group}\Uninstall MenuzQR Print"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\pythonw.exe"; Parameters: """{app}\menuzqr-print-bridge.py"""; Flags: nowait runasoriginaluser
