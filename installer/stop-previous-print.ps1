param([string]$InstallDir)
# Stop only the old/new bridge executables inside this application's folder.
$targets = @((Join-Path $InstallDir 'MenuzQRPrint.exe'), (Join-Path $InstallDir 'pythonw.exe'))
Get-WmiObject Win32_Process | Where-Object { $targets -contains $_.ExecutablePath } | ForEach-Object {
  $null = $_.Terminate()
}
