Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'avatar-lab-launcher-core.ps1')
function Assert-Launcher([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function New-ReadyResponse {
    return [pscustomobject]@{ exitCode = 0; response = [pscustomobject]@{ ok = $true; code = 'ALAMR_PREVIEW_READY'; data = [pscustomobject]@{ previewId = 'pv_fixture'; buildDigest = 'sha256:fixture'; state = 'ready' } } }
}
function New-UnavailableResponse {
    return [pscustomobject]@{ exitCode = 1; response = [pscustomobject]@{ ok = $false; code = 'ALAMR_DESKTOP_UNAVAILABLE'; message = 'Controller starting.' } }
}

$script:attempts = 0; $script:delays = 0
$ready = Invoke-AvatarPreviewReady -MaxAttempts 3 -Delay { param($ms) $script:delays++ } -Invoke {
    $script:attempts++
    if ($script:attempts -lt 3) { New-UnavailableResponse } else { New-ReadyResponse }
}
Assert-Launcher ($script:attempts -eq 3 -and $script:delays -eq 2 -and $ready.data.previewId -eq 'pv_fixture') 'Desktop startup retry did not converge to the actual ready result.'

$script:attempts = 0; $script:delays = 0; $caught = $false
try {
    Invoke-AvatarPreviewReady -MaxAttempts 3 -Delay { param($ms) $script:delays++ } -Invoke { $script:attempts++; New-UnavailableResponse } | Out-Null
} catch { $caught = $_.Exception.Message.Contains('ALAMR_DESKTOP_UNAVAILABLE') }
Assert-Launcher ($caught -and $script:attempts -eq 3 -and $script:delays -eq 2) 'Desktop startup retry exceeded its bound or lost the stable error code.'

$script:attempts = 0; $caught = $false
try {
    Invoke-AvatarPreviewReady -MaxAttempts 3 -Invoke {
        $script:attempts++
        [pscustomobject]@{ exitCode = 1; response = [pscustomobject]@{ ok = $false; code = 'ALAMR_INVALID_MANIFEST'; message = 'Invalid manifest.' } }
    } | Out-Null
} catch { $caught = $_.Exception.Message.Contains('ALAMR_INVALID_MANIFEST') }
Assert-Launcher ($caught -and $script:attempts -eq 1) 'A non-startup error was retried.'

$caught = $false
try {
    Invoke-AvatarPreviewReady -Invoke {
        [pscustomobject]@{ exitCode = 0; response = [pscustomobject]@{ ok = $true; code = 'ALAMR_PREVIEW_READY'; data = [pscustomobject]@{ previewId = ''; buildDigest = ''; state = 'loading' } } }
    } | Out-Null
} catch { $caught = $true }
Assert-Launcher $caught 'Incomplete readiness was accepted as a successful launch.'

$parsed = ConvertFrom-AvatarCliOutput ("Launcher information`n" + '{"ok":true,"code":"ALAMR_PREVIEW_READY"}')
Assert-Launcher ($parsed.code -eq 'ALAMR_PREVIEW_READY') 'CLI JSON could not be recovered from wrapper output.'

$temporary = Join-Path ([IO.Path]::GetTempPath()) ('avatar-launcher-test-' + [Guid]::NewGuid().ToString('N'))
$plugin = Join-Path $temporary 'plugin'; $hostDirectory = Join-Path $temporary 'host'
$olive = Join-Path $temporary 'avatar-olive-man'
$oliveSource = Join-Path $olive 'appearance.mjs'
$oliveAlbedo = Join-Path $olive 'assets/olive-face-albedo.jpg'
$blue = Join-Path $temporary 'avatar-blue-man'
$blueSource = Join-Path $blue 'tailoring.mjs'
$blueAlbedo = Join-Path $blue 'assets/blue-clothing-albedo.jpg'
$elder = Join-Path $temporary 'avatar-elder-man'
$elderAlbedo = Join-Path $elder 'assets/elder-face-albedo.png'
$inputDirectories = @((Join-Path $plugin 'src'), (Join-Path $hostDirectory 'src'), (Join-Path $plugin 'assets-source'), (Join-Path $hostDirectory 'assets-source'), (Join-Path $hostDirectory 'public'), (Join-Path $hostDirectory 'dist'), (Join-Path $olive 'assets'), (Join-Path $blue 'assets'))
New-Item -ItemType Directory -Force -Path $inputDirectories | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $elder 'assets') | Out-Null
try {
    [IO.File]::WriteAllText((Join-Path $plugin 'al-amr.plugin.json'), '{"name":"fixture","version":"0.1.3","range":">=1 <2 & safe"}')
    [IO.File]::WriteAllText((Join-Path $plugin 'package-lock.json'), '{"lockfileVersion":3,"packages":{"":{"name":"fixture"}}}')
    [IO.File]::WriteAllText((Join-Path $plugin 'src/index.mjs'), 'export const marker = 1;')
    [IO.File]::WriteAllText((Join-Path $hostDirectory 'src/main.ts'), 'export const view = 1;')
    [IO.File]::WriteAllText((Join-Path $hostDirectory 'public/al-amr.product.json'), '{"capabilities":[]}')
    [IO.File]::WriteAllText((Join-Path $plugin 'assets-source/model.glb'), 'plugin-model-v1')
    [IO.File]::WriteAllText((Join-Path $hostDirectory 'assets-source/model.onnx'), 'host-model-v1')
    $first = Get-AvatarSourceFingerprint $temporary $plugin $hostDirectory
    # Fixed fixture digest, independently calculated with Node's ordinal path
    # ordering/JSON serialization, guards PS5/PS7 escaping and collation drift.
    Assert-Launcher ($first.sha256 -ceq '03caf05bf4391fcb14f0debe2fb49958f9d6c8fe72da948ecde6ec81f30e0114') 'Source fingerprint format changed across serialization or path ordering.'
    [IO.File]::WriteAllText((Join-Path $plugin 'al-amr.plugin.json'), "{`r`n  `"name`": `"fixture`",`r`n  `"version`": `"0.1.3`",`r`n  `"range`": `"\u003e=1 \u003c2 \u0026 safe`"`r`n}")
    $reformatted = Get-AvatarSourceFingerprint $temporary $plugin $hostDirectory
    Assert-Launcher ($first.sha256 -eq $reformatted.sha256) 'JSON formatting changed the source-value fingerprint.'
    [IO.File]::WriteAllText((Join-Path $hostDirectory 'src/main.ts'), 'export const view = 2;')
    $changed = Get-AvatarSourceFingerprint $temporary $plugin $hostDirectory
    Assert-Launcher ($first.sha256 -ne $changed.sha256) 'A concurrent source edit was not detected.'
    [IO.File]::WriteAllText((Join-Path $hostDirectory 'public/al-amr.product.json'), '{"capabilities":["platform.media.microphone@1"]}')
    $publicChanged = Get-AvatarSourceFingerprint $temporary $plugin $hostDirectory
    Assert-Launcher ($changed.sha256 -ne $publicChanged.sha256) 'The public native permission declaration was not fingerprinted.'
    [IO.File]::WriteAllText((Join-Path $plugin 'assets-source/model.glb'), 'plugin-model-v2')
    $pluginAssetChanged = Get-AvatarSourceFingerprint $temporary $plugin $hostDirectory
    Assert-Launcher ($publicChanged.sha256 -ne $pluginAssetChanged.sha256) 'Plugin source assets were not fingerprinted.'
    [IO.File]::WriteAllText((Join-Path $hostDirectory 'assets-source/model.onnx'), 'host-model-v2')
    $hostAssetChanged = Get-AvatarSourceFingerprint $temporary $plugin $hostDirectory
    Assert-Launcher ($pluginAssetChanged.sha256 -ne $hostAssetChanged.sha256) 'Host source assets were not fingerprinted.'
    [IO.File]::WriteAllText((Join-Path $hostDirectory 'dist/generated.js'), 'generated build content')
    $generatedChanged = Get-AvatarSourceFingerprint $temporary $plugin $hostDirectory
    Assert-Launcher ($hostAssetChanged.sha256 -eq $generatedChanged.sha256) 'Generated dist output was treated as a source edit.'
    [IO.File]::WriteAllText($oliveSource, 'export const profile = 1;')
    $oliveSourceChanged = Get-AvatarSourceFingerprint $temporary $plugin $hostDirectory
    Assert-Launcher ($generatedChanged.sha256 -ne $oliveSourceChanged.sha256) 'The independent olive avatar source was not fingerprinted.'
    [IO.File]::WriteAllText($oliveAlbedo, 'olive-avatar-atlas')
    $oliveAssetChanged = Get-AvatarSourceFingerprint $temporary $plugin $hostDirectory
    Assert-Launcher ($oliveSourceChanged.sha256 -ne $oliveAssetChanged.sha256) 'The independent olive avatar texture was not fingerprinted.'
    [IO.File]::WriteAllText($blueSource, 'export const profile = 2;')
    $blueSourceChanged = Get-AvatarSourceFingerprint $temporary $plugin $hostDirectory
    Assert-Launcher ($oliveAssetChanged.sha256 -ne $blueSourceChanged.sha256) 'The blue avatar source was not fingerprinted.'
    [IO.File]::WriteAllText($blueAlbedo, 'blue-avatar-atlas')
    $blueAssetChanged = Get-AvatarSourceFingerprint $temporary $plugin $hostDirectory
    Assert-Launcher ($blueSourceChanged.sha256 -ne $blueAssetChanged.sha256) 'The blue avatar texture was not fingerprinted.'
    [IO.File]::WriteAllText($elderAlbedo, 'elder-avatar-png-atlas')
    $elderAssetChanged = Get-AvatarSourceFingerprint $temporary $plugin $hostDirectory
    Assert-Launcher ($blueAssetChanged.sha256 -ne $elderAssetChanged.sha256) 'The elder PNG texture was not fingerprinted.'
    $receipt = [ordered]@{ pluginVersion = '0.1.3'; sourceFingerprint = $changed.sha256; previewReady = $true; featureAcceptance = 'not_asserted' }
    $receiptPath = Join-Path $temporary 'last-success.json'
    Write-AvatarLaunchRecord $receiptPath $receipt
    $saved = Get-Content -LiteralPath $receiptPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Launcher ($saved.previewReady -and $saved.featureAcceptance -eq 'not_asserted') 'Saved launch receipt overclaimed feature acceptance.'
} finally {
    if (Test-Path -LiteralPath $elderAlbedo) { Remove-Item -LiteralPath $elderAlbedo }
    Remove-Item -LiteralPath (Join-Path $elder 'assets')
    Remove-Item -LiteralPath $elder
    # Every created file is known and removed individually; no recursive delete.
    foreach ($file in @((Join-Path $plugin 'al-amr.plugin.json'), (Join-Path $plugin 'package-lock.json'), (Join-Path $plugin 'src/index.mjs'), (Join-Path $hostDirectory 'src/main.ts'), (Join-Path $hostDirectory 'public/al-amr.product.json'), (Join-Path $plugin 'assets-source/model.glb'), (Join-Path $hostDirectory 'assets-source/model.onnx'), (Join-Path $hostDirectory 'dist/generated.js'), (Join-Path $temporary 'last-success.json'), $oliveSource, $oliveAlbedo, $blueSource, $blueAlbedo)) {
        if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file }
    }
    foreach ($directory in @($inputDirectories + @($plugin, $hostDirectory, $olive, $blue, $temporary))) {
        if (Test-Path -LiteralPath $directory) { Remove-Item -LiteralPath $directory }
    }
}
Write-Host 'PASS: startup retry, bounds, error handling, readiness identity, source drift and receipt read-back.'
