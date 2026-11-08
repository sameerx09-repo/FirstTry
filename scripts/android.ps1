param([string[]]$Tasks=@('testDebugUnitTest','assembleDebug'))
$ErrorActionPreference='Stop'
$workspace=Split-Path $PSScriptRoot -Parent
$jdk=Get-ChildItem -LiteralPath (Join-Path $workspace '.local/tools') -Directory -Filter 'jdk-*' | Select-Object -First 1
if($jdk){$env:JAVA_HOME=$jdk.FullName}
$localSdk=Join-Path $workspace '.local/android-sdk'
if(Test-Path -LiteralPath $localSdk){$env:ANDROID_HOME=$localSdk}
$env:GRADLE_USER_HOME=Join-Path $workspace '.local/gradle-home'
if($env:OS -eq 'Windows_NT'){$env:JAVA_TOOL_OPTIONS='-Djavax.net.ssl.trustStoreType=Windows-ROOT'}
$gradle=Join-Path $workspace '.local/tools/gradle-8.11.1/bin/gradle.bat'
if(-not (Test-Path -LiteralPath $gradle)){$gradle='gradle'}
& $gradle -p (Join-Path $workspace 'apps/android') @Tasks --console=plain --no-daemon
if($LASTEXITCODE -ne 0){throw "Android build failed ($LASTEXITCODE)"}