param([string]$App='', [int]$Port=5558, [switch]$Headless, [int]$AdbPort=5039)
$ErrorActionPreference='Stop'
$workspace=Split-Path $PSScriptRoot -Parent
$sdk=Join-Path $workspace '.local/android-sdk'
$emulator=Join-Path $sdk 'emulator/emulator.exe'
$adb=Join-Path $sdk 'platform-tools/adb.exe'
$image=Join-Path $sdk 'system-images/android-35/default/x86_64'
if(-not (Test-Path -LiteralPath (Join-Path $image 'system.img'))){throw 'Install the rendered image first: android --sdk .local/android-sdk sdk install system-images/android-35/default/x86_64'}
if($Port -lt 5554 -or $Port -gt 5682 -or $Port % 2 -ne 0){throw 'Port must be an even emulator console port between 5554 and 5682'}
if($App -and $App -notmatch '^[a-z0-9][a-z0-9-]{1,63}$'){throw 'App must be a mini-app slug'}
$env:PATH=(Join-Path $sdk 'platform-tools') + [IO.Path]::PathSeparator + $env:PATH
$env:ANDROID_HOME=$sdk
$env:ANDROID_SDK_ROOT=$sdk
$env:ANDROID_ADB_SERVER_PORT="$AdbPort"
$env:ADB_SERVER_SOCKET="tcp:127.0.0.1:$AdbPort"
$env:ANDROID_USER_HOME=Join-Path $workspace '.local/android-user'
$env:ANDROID_AVD_HOME=Join-Path $workspace '.local/avd'
$avdName='firsttry-visual'
$avd=Join-Path $env:ANDROID_AVD_HOME "$avdName.avd"
New-Item -ItemType Directory -Force -Path $avd | Out-Null
$utf8=[Text.UTF8Encoding]::new($false)
if(-not (Test-Path -LiteralPath (Join-Path $avd 'config.ini'))){
  $configuration=@"
AvdId = $avdName
abi.type = x86_64
avd.ini.displayname = FirstTry Android
avd.ini.encoding = UTF-8
hw.cpu.arch = x86_64
hw.cpu.ncore = 2
hw.ramSize = 2048
hw.lcd.density = 320
hw.lcd.width = 720
hw.lcd.height = 1280
hw.gpu.enabled = yes
hw.gpu.mode = swiftshader
hw.keyboard = yes
image.sysdir.1 = $image
showDeviceFrame = no
tag.id = default
tag.display = Default Android
target = android-35
disk.dataPartition.size = 4294967296
PlayStore.enabled = false
"@
  [IO.File]::WriteAllText((Join-Path $avd 'config.ini'),$configuration,$utf8)
}
[IO.File]::WriteAllText((Join-Path $env:ANDROID_AVD_HOME "$avdName.ini"),"avd.ini.encoding=UTF-8`npath=$avd`ntarget=android-35`n",$utf8)
$serial="127.0.0.1:$($Port+1)"
# Reconnect an already running guest before deciding to create another emulator process.
$probePreference=$ErrorActionPreference
$ErrorActionPreference='Continue'
& $adb -P $AdbPort connect $serial 2>&1 | Out-Null
$ErrorActionPreference=$probePreference
$devices=& $adb -P $AdbPort devices
$devicePattern='^' + [regex]::Escape($serial) + '\s+device\s*$'
if(-not ($devices | Where-Object { $_ -match $devicePattern })){
  # ADB disconnects before QEMU releases the AVD lock during shutdown.
  for($attempt=0;$attempt -lt 30;$attempt++){
    $existing=Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(qemu-system-x86_64|emulator)\.exe$' -and $_.CommandLine -match '-avd\s+firsttry-visual(?:\s|$)' }
    if(-not $existing){break}
    Start-Sleep -Seconds 1
    $probePreference=$ErrorActionPreference
    $ErrorActionPreference='Continue'
    & $adb -P $AdbPort connect $serial 2>&1 | Out-Null
    $ErrorActionPreference=$probePreference
    $devices=& $adb -P $AdbPort devices
    if($devices | Where-Object { $_ -match $devicePattern }){break}
  }
}
if(-not ($devices | Where-Object { $_ -match $devicePattern })){
  if($existing){throw 'The FirstTry emulator is still starting or stopping. Wait a moment and try again.'}
  $output=Join-Path $workspace 'output'
  New-Item -ItemType Directory -Force -Path $output | Out-Null
  $arguments=@('-avd',$avdName,'-port',"$Port",'-no-audio','-no-boot-anim','-gpu','swiftshader','-memory','2048','-cores','2','-no-snapshot','-no-metrics','-feature','-Vulkan')
  if($Headless){$arguments+='-no-window'}
  $window=if($Headless){'Hidden'}else{'Normal'}
  Start-Process -FilePath $emulator -ArgumentList $arguments -WindowStyle $window -RedirectStandardOutput (Join-Path $output 'emulator-visual.log') -RedirectStandardError (Join-Path $output 'emulator-visual-error.log') | Out-Null
  Write-Output "Starting $avdName; waiting for Android to boot..."
  $deadline=(Get-Date).AddMinutes(4)
  do {
    Start-Sleep -Seconds 3
    $probePreference=$ErrorActionPreference
    $ErrorActionPreference='Continue'
    & $adb -P $AdbPort connect $serial 2>&1 | Out-Null
    $boot=& $adb -P $AdbPort -s $serial shell getprop sys.boot_completed 2>$null
    $ErrorActionPreference=$probePreference
    if((Get-Date) -gt $deadline){throw 'Emulator boot timed out; inspect output/emulator-visual*.log'}
  } until($boot -eq '1')
}
$identity=(& $adb -P $AdbPort -s $serial shell getprop ro.boot.qemu.avd_name).Trim()
if($identity -ne $avdName){throw "Port $Port belongs to another emulator; choose a different -Port"}
& $adb -P $AdbPort -s $serial shell input keyevent KEYCODE_WAKEUP | Out-Null
& $adb -P $AdbPort -s $serial shell wm dismiss-keyguard | Out-Null
& node (Join-Path $PSScriptRoot 'adb.mjs') run --serial $serial --port $AdbPort
if($LASTEXITCODE -ne 0){throw 'FirstTry installation or launch failed'}
if($App){
  & node (Join-Path $PSScriptRoot 'adb.mjs') open-link "firsttry://mini/$App" --serial $serial --port $AdbPort
  if($LASTEXITCODE -ne 0){throw 'Mini-app launch failed'}
}
Write-Output "FirstTry is ready on $serial. Keep the local API running."
