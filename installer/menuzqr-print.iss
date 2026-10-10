[Setup]
AppId={{F55891DE-94BB-4AD6-A10C-ED4CDF7AD91C}
AppName=MenuzQR Print
AppVersion=3.0.0
AppPublisher=MenuzQR
AppPublisherURL=https://menuzqr.shop
DefaultDirName={localappdata}\Programs\MenuzQR Print
DefaultGroupName=MenuzQR Print
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=yes
CloseApplications=yes
RestartApplications=no
OutputDir=output
OutputBaseFilename=MenuzQR-Print-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\MenuzQRPrint.exe

[Files]
Source: "..\dist\MenuzQRPrint\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "MenuzQRPrint"; ValueData: """{app}\MenuzQRPrint.exe"""; Flags: uninsdeletevalue

[Icons]
Name: "{group}\MenuzQR Print"; Filename: "{app}\MenuzQRPrint.exe"
Name: "{group}\Uninstall MenuzQR Print"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\MenuzQRPrint.exe"; Flags: nowait runasoriginaluser
