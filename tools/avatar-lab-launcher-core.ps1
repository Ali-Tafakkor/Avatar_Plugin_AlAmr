Set-StrictMode -Version Latest

function ConvertFrom-AvatarCliOutput {
    param([string]$Text)
    $clean = $Text.Trim().TrimStart([char]0xFEFF)
    if (-not $clean) { throw 'The Al-Amr CLI returned no result.' }
    try { return ($clean | ConvertFrom-Json -ErrorAction Stop) } catch {}
    # Windows command wrappers may add an informational line before JSON.
    $lines = @($clean -split '\r?\n')
    for ($index = $lines.Length - 1; $index -ge 0; $index--) {
        if (-not $lines[$index].TrimStart().StartsWith('{')) { continue }
        try { return ($lines[$index] | ConvertFrom-Json -ErrorAction Stop) } catch {}
    }
    throw 'The Al-Amr CLI did not return a readable JSON result. See the startup log.'
}

function Invoke-AvatarPreviewReady {
    param(
        [Parameter(Mandatory = $true)][scriptblock]$Invoke,
        [scriptblock]$Delay = { param($Milliseconds) Start-Sleep -Milliseconds $Milliseconds },
        [int]$MaxAttempts = 12,
        [int]$DelayMilliseconds = 1000
    )
    if ($MaxAttempts -lt 1) { throw 'At least one preview attempt is required.' }
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        $result = & $Invoke
        $response = $result.response
        if ($result.exitCode -eq 0 -and $response.ok -and $response.code -eq 'ALAMR_PREVIEW_READY') {
            if (-not $response.data.previewId -or -not $response.data.buildDigest -or $response.data.state -ne 'ready') {
                throw 'Al-Amr reported success without a ready preview identity and build digest.'
            }
            return $response
        }
        # This code states that the controller was not contacted, so retrying
        # cannot duplicate an already-opened preview. Other outcomes are final.
        if ($response.code -eq 'ALAMR_DESKTOP_UNAVAILABLE' -and $attempt -lt $MaxAttempts) {
            & $Delay $DelayMilliseconds | Out-Null
            continue
        }
        throw ('Al-Amr preview did not open (' + $response.code + '): ' + $response.message)
    }
}

function Get-AvatarSourceFingerprint {
    param([string]$ProjectRoot, [string]$PluginDirectory, [string]$HostDirectory)
    $files = @()
    foreach ($directory in @($PluginDirectory, $HostDirectory)) {
        # Only build inputs: generated dist/.public-production, dependencies,
        # experiments and evidence must not change the source fingerprint.
        foreach ($name in @('src', 'scripts', 'public', 'assets-source')) {
            $inputDirectory = Join-Path $directory $name
            if (Test-Path -LiteralPath $inputDirectory) {
                $files += @(Get-ChildItem -LiteralPath $inputDirectory -File -Recurse | Select-Object -ExpandProperty FullName)
            }
        }
        foreach ($name in @('package.json', 'package-lock.json', 'tsconfig.json', 'al-amr.plugin.json', 'al-amr.environment.json', 'alamr.d.ts', 'al-amr.d.ts', 'index.html')) {
            $file = Join-Path $directory $name
            if (Test-Path -LiteralPath $file) { $files += $file }
        }
        $files += @(Get-ChildItem -LiteralPath $directory -File -Filter 'vite*.ts' | Select-Object -ExpandProperty FullName)
    }
    foreach ($name in @('Open-Avatar-Lab.cmd', 'tools/start-avatar-lab.ps1', 'tools/avatar-lab-launcher-core.ps1')) {
        $file = Join-Path $ProjectRoot $name
        if (Test-Path -LiteralPath $file) { $files += $file }
    }
    $records = @()
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    # Use the build's Node serializer on both PowerShell versions: PS5's own
    # ConvertTo-Json escapes '<'/'>' while PS7 leaves them literal.
    $manifestHashScript = "const fs=require('node:fs'),crypto=require('node:crypto'); const text=fs.readFileSync(process.argv[1],'utf8').replace(/^\uFEFF/,''); process.stdout.write(crypto.createHash('sha256').update(JSON.stringify(JSON.parse(text))).digest('hex'));"
    # PowerShell 5 and 7 also use different culture collation rules. Keep the
    # record order ordinal so identical input bytes produce identical receipts.
    $fileSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($file in $files) { [void]$fileSet.Add($file) }
    [string[]]$orderedFiles = @($fileSet)
    [Array]::Sort($orderedFiles, [StringComparer]::Ordinal)
    foreach ($file in $orderedFiles) {
        $relative = $file.Substring($ProjectRoot.Length).TrimStart('\', '/').Replace('\', '/')
        if ([IO.Path]::GetFileName($file) -in @('al-amr.plugin.json', 'al-amr.environment.json')) {
            # The build normalizes manifest formatting. Compare JSON values,
            # rather than mistaking whitespace changes for concurrent edits.
            $digest = & $nodePath -e $manifestHashScript $file
            if ($LASTEXITCODE -ne 0 -or $digest -cnotmatch '^[a-f0-9]{64}$') { throw ('Cannot fingerprint product manifest: ' + $file) }
        } else { $digest = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() }
        $records += ($relative + ':' + $digest)
    }
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { $combined = [BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes(($records -join "`n")))).Replace('-', '').ToLowerInvariant() } finally { $hasher.Dispose() }
    return [pscustomobject]@{ sha256 = $combined; files = $records.Length }
}

function Write-AvatarLaunchRecord {
    param([string]$Path, [object]$Record)
    [IO.File]::WriteAllText($Path, ($Record | ConvertTo-Json -Depth 12) + "`n", (New-Object Text.UTF8Encoding($false)))
    $readBack = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($readBack.sourceFingerprint -ne $Record.sourceFingerprint -or $readBack.pluginVersion -ne $Record.pluginVersion) {
        throw 'The local launch receipt could not be verified after saving.'
    }
}
