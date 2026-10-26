# PurpleEgg - one-click build script (ASCII-only source; Chinese name built from code points).
# Usage: powershell -ExecutionPolicy Bypass -File tools\build-apk.ps1
$ErrorActionPreference = 'Stop'

$root   = Split-Path -Parent $PSScriptRoot   # repo root == Gradle project root
$tc     = Join-Path $root '.toolchain'
$jdk    = Join-Path $tc 'jdk17'
$sdk    = Join-Path $tc 'android-sdk'
$proj   = $root
$gradle = Join-Path $tc 'gradle-8.7\bin\gradle.bat'
$ver    = '1.0.0'

$env:JAVA_HOME        = $jdk
$env:ANDROID_HOME     = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:GRADLE_USER_HOME = Join-Path $tc 'gradle-home'
$env:ANDROID_USER_HOME = Join-Path $tc 'android-home'
$env:PATH = (Join-Path $jdk 'bin') + ';' + $env:PATH
New-Item -ItemType Directory -Force -Path $env:ANDROID_USER_HOME | Out-Null

foreach ($p in @($jdk, $sdk, $gradle)) {
    if (-not (Test-Path $p)) { throw "toolchain missing: $p  (run: node tools/setup-toolchain.mjs)" }
}

# --- keystore + keystore.properties (random password, never committed) ---
$ksDir   = Join-Path $proj 'keystore'
$ks      = Join-Path $ksDir 'purpleegg.jks'
$ksProps = Join-Path $proj 'keystore.properties'
if (-not (Test-Path $ks)) {
    New-Item -ItemType Directory -Force -Path $ksDir | Out-Null
    $pass = -join ((48..57) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    & (Join-Path $jdk 'bin\keytool.exe') -genkeypair -v -keystore $ks -alias purpleegg `
        -keyalg RSA -keysize 2048 -validity 10000 -storepass $pass -keypass $pass `
        -dname "CN=PurpleEgg, OU=App, O=PurpleEgg, C=CN" | Out-Null
    $lines = @("storeFile=keystore/purpleegg.jks", "storePassword=$pass", "keyAlias=purpleegg", "keyPassword=$pass")
    [System.IO.File]::WriteAllLines($ksProps, $lines, (New-Object System.Text.UTF8Encoding($false)))
    "keystore created: $ks"
}

# --- local.properties: escape non-ASCII so Java's ISO-8859-1 property reader is happy ---
function To-PropPath([string]$p) {
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $p.ToCharArray()) {
        $code = [int]$ch
        if ($code -eq 92) { [void]$sb.Append('\\') }
        elseif ($code -gt 126 -or $code -lt 32) { [void]$sb.Append('\u' + $code.ToString('x4')) }
        elseif ($ch -eq ':' -or $ch -eq '=' -or $ch -eq '#') { [void]$sb.Append('\' + $ch) }
        else { [void]$sb.Append($ch) }
    }
    return $sb.ToString()
}
Set-Content -Path (Join-Path $proj 'local.properties') -Value ("sdk.dir=" + (To-PropPath $sdk)) -Encoding ASCII

# --- build ---
"== gradle assembleRelease =="
& $gradle -p $proj assembleRelease --no-daemon --console=plain
if ($LASTEXITCODE -ne 0) { throw "gradle failed with code $LASTEXITCODE" }

$built = Join-Path $proj 'app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path $built)) { throw "apk not found: $built" }

# --- verify ---
$apksigner = Join-Path $sdk 'build-tools\34.0.0\apksigner.bat'
$aapt2     = Join-Path $sdk 'build-tools\34.0.0\aapt2.exe'
"== apksigner verify =="
& $apksigner verify --print-certs $built
if ($LASTEXITCODE -ne 0) { throw "apksigner verify failed" }
"== aapt2 dump badging (head) =="
$badging = & $aapt2 dump badging $built 2>&1
$badging | Select-Object -First 12

# --- deliver ---
$appName = -join ([char[]](0x7D2B, 0x8272, 0x7684, 0x86CB))   # "紫色的蛋"
$apkName = $appName + '-v' + $ver + '.apk'
$out = Join-Path $root $apkName
Copy-Item $built $out -Force
$sizeMB = [math]::Round((Get-Item $out).Length / 1MB, 2)
""
"APK  ->  $out   ($sizeMB MB)"
