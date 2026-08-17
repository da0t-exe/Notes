<#
  Packs the release binary into a signed MSIX plus an .appinstaller manifest.

  Run `npm run dist` first — this consumes the release exe, it does not build it.

  The signing certificate never lives in this repository. Point NOTES_PFX at it
  and put its password in NOTES_PFX_PASSWORD:

      $env:NOTES_PFX = "C:\path\to\Notes.pfx"
      $env:NOTES_PFX_PASSWORD = "..."
      npm run dist:appinstaller

  The v0.3 version of this script carried the password inline and wrote
  file:/// URIs pointing at the author's Desktop, which meant the published
  .appinstaller could not install or update on any other machine. Both are
  fixed here: the URIs target the GitHub release, so the package actually
  updates itself.
#>

$ErrorActionPreference = 'Stop'

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding $false))
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$pkg = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$semver = $pkg.version
$version = "$semver.0"

$identity = 'Notes'
$publisher = 'CN=da0t-exe'
$publisherDisplay = 'da0t-exe'
$arch = 'x64'
$repo = 'https://github.com/da0t-exe/Notes'

# --- signing material -------------------------------------------------------

$pfx = $env:NOTES_PFX
$pwdPlain = $env:NOTES_PFX_PASSWORD
if (-not $pfx -or -not (Test-Path $pfx)) {
  throw "Set NOTES_PFX to the signing certificate. It must not live in this repository."
}
if (-not $pwdPlain) {
  throw "Set NOTES_PFX_PASSWORD to the certificate password."
}

# --- Windows SDK ------------------------------------------------------------

$sdkRoot = 'C:\Program Files (x86)\Windows Kits\10\bin'
$sdk = Get-ChildItem $sdkRoot -Directory -ErrorAction SilentlyContinue |
  Where-Object { Test-Path (Join-Path $_.FullName "$arch\makeappx.exe") } |
  Sort-Object Name -Descending | Select-Object -First 1
if (-not $sdk) { throw "makeappx.exe not found under $sdkRoot. Install the Windows SDK." }

$makeappx = Join-Path $sdk.FullName "$arch\makeappx.exe"
$signtool = Join-Path $sdk.FullName "$arch\signtool.exe"

# --- inputs -----------------------------------------------------------------

$exe = Join-Path $root 'src-tauri\target\release\notes.exe'
if (-not (Test-Path $exe)) { throw "notes.exe not found. Run `npm run dist` first." }

$packDir = Join-Path $root 'packaging'
$layout = Join-Path $packDir 'msix-layout'
$assets = Join-Path $layout 'Assets'
$outMsix = Join-Path $packDir "Notes_${version}_${arch}.msix"
$outAppinstaller = Join-Path $packDir 'Notes.appinstaller'

if (Test-Path $layout) { Remove-Item -Recurse -Force $layout }
New-Item -ItemType Directory -Force -Path $assets | Out-Null

Copy-Item -Force $exe (Join-Path $layout 'notes.exe')
$icons = Join-Path $root 'src-tauri\icons'
foreach ($logo in 'StoreLogo.png', 'Square44x44Logo.png', 'Square71x71Logo.png', 'Square150x150Logo.png') {
  Copy-Item -Force (Join-Path $icons $logo) (Join-Path $assets $logo)
}

# --- manifest ---------------------------------------------------------------

$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">
  <Identity Name="$identity" Publisher="$publisher" Version="$version" ProcessorArchitecture="$arch" />
  <Properties>
    <DisplayName>Notes</DisplayName>
    <PublisherDisplayName>$publisherDisplay</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources>
    <Resource Language="en-us" />
  </Resources>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
  <Applications>
    <Application Id="Notes" Executable="notes.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="Notes"
        Description="A minimalist native text editor for Windows."
        BackgroundColor="transparent"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png">
        <uap:DefaultTile Square71x71Logo="Assets\Square71x71Logo.png" />
      </uap:VisualElements>
    </Application>
  </Applications>
</Package>
"@
Write-Utf8NoBom (Join-Path $layout 'AppxManifest.xml') $manifest

# --- pack and sign ----------------------------------------------------------

if (Test-Path $outMsix) { Remove-Item -Force $outMsix }
& $makeappx pack /d $layout /p $outMsix /o
if ($LASTEXITCODE -ne 0) { throw 'makeappx failed' }

& $signtool sign /fd SHA256 /td SHA256 /f $pfx /p $pwdPlain $outMsix
if ($LASTEXITCODE -ne 0) { throw 'signtool failed' }

# --- appinstaller -----------------------------------------------------------

# The manifest URI points at releases/latest so Windows re-reads it and finds
# newer versions; the package URI is pinned to this exact tag.
$installerUri = "$repo/releases/latest/download/Notes.appinstaller"
$msixUri = "$repo/releases/download/v$semver/Notes_${version}_${arch}.msix"

$appinstaller = @"
<?xml version="1.0" encoding="utf-8"?>
<AppInstaller
    xmlns="http://schemas.microsoft.com/appx/appinstaller/2018"
    Version="$version"
    Uri="$installerUri">
  <MainPackage
    Name="$identity"
    Publisher="$publisher"
    Version="$version"
    ProcessorArchitecture="$arch"
    Uri="$msixUri" />
  <UpdateSettings>
    <OnLaunch HoursBetweenUpdateChecks="12" />
  </UpdateSettings>
</AppInstaller>
"@
Write-Utf8NoBom $outAppinstaller $appinstaller

Write-Host "MSIX=$outMsix"
Write-Host "APPINSTALLER=$outAppinstaller"
