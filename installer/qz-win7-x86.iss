[Setup]
AppId={{7F627AF7-2C71-47E3-9696-45807B7C58A7}
AppName=MenuzQR QZ Windows 7 Compatibility
AppVersion=1.0.0
AppPublisher=MenuzQR
DefaultDirName={autopf32}\QZ Tray
DisableDirPage=yes
DisableProgramGroupPage=yes
MinVersion=6.1sp1
PrivilegesRequired=admin
OutputDir=output
OutputBaseFilename=MenuzQR-QZ-Win7-x86-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
UninstallDisplayIcon={app}\qz-tray.exe
InfoBeforeFile=qz-win7-notice.txt

[Files]
Source: "..\dist\qz-win7\jre\*"; DestDir: "{app}\jre"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist\qz-win7\qz-setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "qz-win7-notice.txt"; DestDir: "{app}"; Flags: ignoreversion

[UninstallRun]
Filename: "{app}\uninstall.exe"; Parameters: "/S"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveBundledQZ"

[Code]
function SetEnvironmentVariable(Name, Value: String): Boolean;
  external 'SetEnvironmentVariableW@kernel32.dll stdcall';

procedure CurStepChanged(CurStep: TSetupStep);
var
  Code: Integer;
begin
  if CurStep = ssPostInstall then begin
    { Process-only setting. Do not replace the user's global Java installation. }
    if not SetEnvironmentVariable('JAVA_HOME', ExpandConstant('{app}\jre')) then
      RaiseException('Could not configure the bundled Java runtime.');
    WizardForm.StatusLabel.Caption := 'Installing QZ Tray and local HTTPS certificate...';
    if not Exec(ExpandConstant('{tmp}\qz-setup.exe'), '/S /D=' + ExpandConstant('{app}'), '', SW_HIDE, ewWaitUntilTerminated, Code) then
      RaiseException('Could not start QZ installation.');
    if Code <> 0 then
      RaiseException('QZ installation failed. Error: ' + IntToStr(Code));
    if not FileExists(ExpandConstant('{app}\qz-tray.jar')) then
      RaiseException('QZ installation did not produce the application. Check the setup log.');
    if not FileExists(ExpandConstant('{app}\qz-tray.properties')) then
      RaiseException('QZ local certificate configuration is missing. Check the setup log.');
  end;
end;
