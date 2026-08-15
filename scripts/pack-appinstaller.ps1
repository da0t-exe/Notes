function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Text, $utf8)
}

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$version = "0.2.0.0"
$pkgJson = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
if ($pkgJson.version) { $version = "$($pkgJson.version).0" }

$identity = "Notes"
$publisher = "CN=da0t-exe"
$display = "Notes"
$publisherDisplay = "da0t-exe"
$arch = "x64"

$sdkBin = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64"
$makeappx = Join-Path $sdkBin "makeappx.exe"
$signtool = Join-Path $sdkBin "signtool.exe"
if (-not (Test-Path $makeappx)) { throw "makeappx.exe not found in Windows SDK" }
if (-not (Test-Path $signtool)) { throw "signtool.exe not found in Windows SDK" }

$exeCandidates = @(
  $args[0]
  "C:\Users\Dot\Desktop\Notes.exe"
  "C:\Users\Dot\AppData\Local\Temp\cursor-sandbox-cache\cd6c8b4ca744b620fded82608df1c8ac\cargo-target\release\notes.exe"
)
$exe = $exeCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $exe) { throw "notes.exe not found. Build the app first." }

$packDir = Join-Path $root "packaging"
$layout = Join-Path $packDir "msix-layout"
$assets = Join-Path $layout "Assets"
$certDir = Join-Path $packDir "cert"
$outMsix = Join-Path $packDir "Notes_${version}_${arch}.msix"
$outAppinstaller = Join-Path $packDir "Notes.appinstaller"

New-Item -ItemType Directory -Force -Path $assets, $certDir | Out-Null
Get-ChildItem $layout -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $assets | Out-Null

Copy-Item -Force $exe (Join-Path $layout "notes.exe")

$iconRoot = Join-Path $root "src-tauri\icons"
Copy-Item -Force (Join-Path $iconRoot "StoreLogo.png") (Join-Path $assets "StoreLogo.png")
Copy-Item -Force (Join-Path $iconRoot "Square44x44Logo.png") (Join-Path $assets "Square44x44Logo.png")
Copy-Item -Force (Join-Path $iconRoot "Square71x71Logo.png") (Join-Path $assets "Square71x71Logo.png")
Copy-Item -Force (Join-Path $iconRoot "Square150x150Logo.png") (Join-Path $assets "Square150x150Logo.png")

$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">
  <Identity Name="$identity" Publisher="$publisher" Version="$version" ProcessorArchitecture="$arch" />
  <Properties>
    <DisplayName>$display</DisplayName>
    <PublisherDisplayName>$publisherDisplay</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
    <Description>Notes — native Windows editor</Description>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources>
    <Resource Language="en-us" />
  </Resources>
  <Applications>
    <Application Id="Notes" Executable="notes.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="$display"
        Description="Notes — native Windows editor"
        BackgroundColor="#06080a"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png">
        <uap:DefaultTile Square71x71Logo="Assets\Square71x71Logo.png" />
      </uap:VisualElements>
    </Application>
  </Applications>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
"@
Write-Utf8NoBom (Join-Path $layout "AppxManifest.xml") $manifest

$pfx = Join-Path $certDir "Notes.pfx"
$cer = Join-Path $certDir "Notes.cer"
$pwdPlain = "NotesLocalSign"
$pwd = ConvertTo-SecureString -String $pwdPlain -Force -AsPlainText

if (-not (Test-Path $pfx)) {
  $cert = New-SelfSignedCertificate `
    -Type Custom `
    -Subject $publisher `
    -FriendlyName "da0t-exe" `
    -KeyUsage DigitalSignature `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
  Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pwd | Out-Null
  Export-Certificate -Cert $cert -FilePath $cer | Out-Null
}

if (-not (Test-Path $cer)) {
  $imported = Import-PfxCertificate -FilePath $pfx -CertStoreLocation "Cert:\CurrentUser\My" -Password $pwd
  Export-Certificate -Cert $imported -FilePath $cer | Out-Null
}

Import-Certificate -FilePath $cer -CertStoreLocation "Cert:\CurrentUser\TrustedPeople" | Out-Null

if (Test-Path $outMsix) { Remove-Item -Force $outMsix }
& $makeappx pack /d $layout /p $outMsix /o
if ($LASTEXITCODE -ne 0) { throw "makeappx failed" }

& $signtool sign /fd SHA256 /td SHA256 /f $pfx /p $pwdPlain $outMsix
if ($LASTEXITCODE -ne 0) { throw "signtool failed" }

$desktop = [Environment]::GetFolderPath("Desktop")
$desktopMsix = Join-Path $desktop "Notes_${version}_${arch}.msix"
$desktopInstaller = Join-Path $desktop "Notes.appinstaller"

Copy-Item -Force $outMsix $desktopMsix

$msixUri = ([Uri]$desktopMsix).AbsoluteUri
$installerUri = ([Uri]$desktopInstaller).AbsoluteUri
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
</AppInstaller>
"@
Write-Utf8NoBom $outAppinstaller $appinstaller
Copy-Item -Force $outAppinstaller $desktopInstaller

# Replace the old NSIS setup if present
$oldSetup = Join-Path $desktop "Notes_0.2.0_x64-setup.exe"
if (Test-Path $oldSetup) { Remove-Item -Force $oldSetup }

Write-Host "APPINSTALLER=$desktopInstaller"
Write-Host "MSIX=$desktopMsix"
