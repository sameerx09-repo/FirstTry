param([Parameter(Mandatory=$true)][string]$Uri, [switch]$NoDialog)
$ErrorActionPreference='Stop'
$workspace=Split-Path $PSScriptRoot -Parent
$log=Join-Path $workspace '.local/android-link.log'
New-Item -ItemType Directory -Force -Path (Split-Path $log -Parent) | Out-Null
$transcript=[System.Collections.Generic.List[string]]::new()
$transcript.Add((Get-Date -Format o))
[IO.File]::WriteAllLines($log,$transcript)
try {
  # Validate before starting any device or forwarding arguments to Android.
  & node (Join-Path $PSScriptRoot 'adb.mjs') validate-link $Uri | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Invalid FirstTry app link.'}
  try { $health=Invoke-RestMethod 'http://127.0.0.1:3001/api/v1/health' -TimeoutSec 5; if($health.status -ne 'ok'){throw 'API not ready'} } catch { throw 'The FirstTry local API is stopped. Run pnpm dev in the workspace, then open the link again.' }
  $port=if($env:FIRSTTRY_ADB_PORT){[int]$env:FIRSTTRY_ADB_PORT}else{5039}
  $adb=Join-Path $workspace '.local/android-sdk/platform-tools/adb.exe'
  $listing=& $adb -P $port devices
  $ready=@($listing | Where-Object { $_ -match '^\S+\s+device\s*$' })
  if($ready.Count -eq 0){
    $transcript.Add('No device connected; starting the visible FirstTry emulator.')
    [IO.File]::WriteAllLines($log,$transcript)
    $started=& (Join-Path $PSScriptRoot 'emulator.ps1') -AdbPort $port
    $transcript.Add(($started -join "`n"))
    if($LASTEXITCODE -ne 0){throw 'Android emulator startup failed. Inspect output/emulator-visual*.log.'}
  }
  $output=& node (Join-Path $PSScriptRoot 'adb.mjs') open-link $Uri --port $port 2>&1
  $result=$LASTEXITCODE
  $transcript.Add(($output -join "`n"))
  if($result -ne 0){throw 'FirstTry could not open the app on the selected device.'}
  $emulator=Get-Process | Where-Object { $_.MainWindowTitle -like 'Android Emulator - firsttry-visual:*' } | Select-Object -First 1
  if($emulator){
    try {
      $shell=New-Object -ComObject WScript.Shell
      $focused=$shell.AppActivate($emulator.Id)
      $transcript.Add("Emulator window activation requested: $focused")
    } catch { $transcript.Add('App opened; Windows did not allow foreground activation.') }
  }
  $transcript.Add('Exit: 0')
  [IO.File]::WriteAllLines($log,$transcript)
} catch {
  $transcript.Add("Failed: $($_.Exception.Message)")
  [IO.File]::WriteAllLines($log,$transcript)
  if(-not $NoDialog){
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show("$($_.Exception.Message)`n`nStart the local API if it is stopped. Details: $log",'FirstTry Android launcher','OK','Error') | Out-Null
  }
  Write-Output $_.Exception.Message
  exit 1
}
