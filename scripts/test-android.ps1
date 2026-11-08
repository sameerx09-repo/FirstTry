param([string]$Serial='', [int]$AdbPort=5039)
$ErrorActionPreference='Stop'
$arguments=@((Join-Path $PSScriptRoot 'adb.mjs'), 'test', '--port', "$AdbPort")
if($Serial){$arguments+=@('--serial', $Serial)}
& node @arguments
if($LASTEXITCODE -ne 0){throw 'Android instrumentation failed; inspect output/android-instrumentation.txt'}
