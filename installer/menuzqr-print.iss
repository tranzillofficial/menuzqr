[Setup]
AppId={{F55891DE-94BB-4AD6-A10C-ED4CDF7AD91C}
AppName=MenuzQR Print
AppVersion=6.0.0
AppPublisher=MenuzQR
AppPublisherURL=https://menuzqr.shop
DefaultDirName={localappdata}\Programs\MenuzQR Print
DefaultGroupName=MenuzQR Print
PrivilegesRequired=lowest
MinVersion=6.1sp1
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
Source: "stop-previous-print.ps1"; Flags: dontcopy
Source: "..\dist\native\MenuzQRPrint.exe"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "MenuzQRPrint"; ValueData: """{app}\MenuzQRPrint.exe"" --background"; Flags: uninsdeletevalue

[Icons]
Name: "{group}\MenuzQR Print"; Filename: "{app}\MenuzQRPrint.exe"
Name: "{group}\Uninstall MenuzQR Print"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\MenuzQRPrint.exe"; Flags: nowait runasoriginaluser

[InstallDelete]
Type: files; Name: "{app}\pythonw.exe"
Type: files; Name: "{app}\python.exe"
Type: files; Name: "{app}\menuzqr-print-bridge.py"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ExitCode: Integer;
begin
  Result := '';
  ExtractTemporaryFile('stop-previous-print.ps1');
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\stop-previous-print.ps1') + '" -InstallDir "' + ExpandConstant('{app}') + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
    Result := 'Close MenuzQR Print and run this installer again.';
end;
