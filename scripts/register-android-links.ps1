param([switch]$Unregister)
$ErrorActionPreference='Stop'
if($env:OS -ne 'Windows_NT'){throw 'Windows URL registration is only available on Windows. Use pnpm android:open on other systems.'}
$workspace=Split-Path $PSScriptRoot -Parent
$key='HKCU:\Software\Classes\firsttry'
$existing=Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
if($existing -and $existing.FirstTryWorkspace -ne $workspace){throw 'Another application owns firsttry://. Its registration was preserved.'}
if($Unregister){
  if($existing){
    # Fixed, verified per-user protocol key only; never another application's handler.
    Remove-Item -LiteralPath $key -Recurse
  }
  Write-Output 'Removed this workspace FirstTry link handler.'
  exit 0
}
$windowsPowerShell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$handler=Join-Path $PSScriptRoot 'open-android-link.ps1'
$command='"{0}" -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{1}" -Uri "%1"' -f $windowsPowerShell,$handler
New-Item -Path "$key\shell\open\command" -Force | Out-Null
Set-Item -LiteralPath $key -Value 'URL:FirstTry Android development link'
New-ItemProperty -LiteralPath $key -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
New-ItemProperty -LiteralPath $key -Name 'FirstTryWorkspace' -Value $workspace -PropertyType String -Force | Out-Null
Set-Item -LiteralPath "$key\shell\open\command" -Value $command
Write-Output 'Registered firsttry:// for the current Windows user. Links open on the selected ADB device.'
Write-Output 'FirstTry must be installed on the device and the local API must be running. Diagnostics: .local/android-link.log'
