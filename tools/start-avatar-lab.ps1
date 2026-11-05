[CmdletBinding()]
param([switch]$BuildOnly)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'avatar-lab-launcher-core.ps1')
$projectRoot = Split-Path -Parent $PSScriptRoot
$hostDirectory = Join-Path $projectRoot 'avatar-lab'
$stateDirectory = Join-Path $projectRoot '.local\avatar-lab-launcher'
New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null
$logPath = Join-Path $stateDirectory 'latest.log'
Set-Content -LiteralPath $logPath -Encoding UTF8 -Value ('Avatar Lab local startup ' + (Get-Date).ToString('o'))

function Invoke-Step {
    param([string]$Label, [string]$Directory, [string]$Program, [string[]]$Arguments)
    Write-Host "`n$Label" -ForegroundColor Cyan
    Add-Content -LiteralPath $logPath -Encoding UTF8 -Value "`n$Label"
    Push-Location -LiteralPath $Directory
    try {
        # Native tools can emit harmless warnings on stderr in Windows PS5.
        $savedPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & $Program @Arguments 2>&1 | ForEach-Object {
            $line = [string]$_
            Write-Host $line
            Add-Content -LiteralPath $logPath -Encoding UTF8 -Value $line
        }
        $resultCode = $LASTEXITCODE
        $ErrorActionPreference = $savedPreference
        if ($resultCode -ne 0) { throw "$Label failed (exit $resultCode). See $logPath" }
    } finally { Pop-Location }
}

function Ensure-Dependencies {
    param([string]$Directory, [string]$Name)
    $packagePath = Join-Path $Directory 'package.json'
    $lockPath = Join-Path $Directory 'package-lock.json'
    $fingerprint = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash + (Get-FileHash -LiteralPath $lockPath -Algorithm SHA256).Hash
    $stampPath = Join-Path $stateDirectory ($Name + '-dependencies.txt')
    $installed = Test-Path -LiteralPath (Join-Path $Directory 'node_modules')
    $stampExists = Test-Path -LiteralPath $stampPath
    $changed = $stampExists -and ((Get-Content -LiteralPath $stampPath -Raw).Trim() -ne $fingerprint)
    if ($installed -and -not $changed) {
        Push-Location -LiteralPath $Directory
        try {
            $probePreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            $probeOutput = & $npmPath ls --depth=0 --json 2>&1 | Out-String
            $installed = $LASTEXITCODE -eq 0
        } finally { $ErrorActionPreference = $probePreference; Pop-Location }
    }
    if (-not $installed -or $changed) {
        Invoke-Step "Install locked dependencies: $Name" $Directory $npmPath @('ci', '--no-audit', '--fund=false', '--install-links=false')
    }
    Set-Content -LiteralPath $stampPath -Encoding ASCII -Value $fingerprint
}

function Invoke-PreviewAttempt {
    Push-Location -LiteralPath $hostDirectory
    try {
        $savedPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $lines = @(& $cliPath dev --json 2>&1)
        $resultCode = $LASTEXITCODE
        $ErrorActionPreference = $savedPreference
        foreach ($line in $lines) {
            Write-Host ([string]$line)
            Add-Content -LiteralPath $logPath -Encoding UTF8 -Value ([string]$line)
        }
        $response = ConvertFrom-AvatarCliOutput (($lines | ForEach-Object { [string]$_ }) -join "`n")
        return [pscustomobject]@{ exitCode = $resultCode; response = $response }
    } finally { $ErrorActionPreference = $savedPreference; Pop-Location }
}

$mutex = $null
$ownsMutex = $false
try {
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    $npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
    $cliPath = Join-Path $env:APPDATA 'al-amr\bin\alamr.cmd'
    if (-not (Test-Path -LiteralPath $cliPath)) { throw 'Al-Amr Desktop CLI is missing. Install/open Al-Amr Desktop first.' }
    $hostPackage = Get-Content -LiteralPath (Join-Path $hostDirectory 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $pluginName = '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03'
    $dependency = $hostPackage.dependencies.$pluginName
    if (-not $dependency.StartsWith('file:')) { throw 'The lab must use its local avatar Plugin dependency.' }
    $pluginDirectory = [IO.Path]::GetFullPath((Join-Path $hostDirectory $dependency.Substring(5)))
    if (-not $pluginDirectory.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'The local Plugin is outside this workspace.' }
    # One project lock remains the same even when a dependency lockfile changes.
    $projectHasher = [Security.Cryptography.SHA256]::Create()
    try { $mutexId = [BitConverter]::ToString($projectHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectRoot.ToLowerInvariant()))).Replace('-', '').Substring(0,24) } finally { $projectHasher.Dispose() }
    $mutex = New-Object System.Threading.Mutex($false, ('Local\AvatarLab-' + $mutexId))
    $ownsMutex = $mutex.WaitOne(0)
    if (-not $ownsMutex) { throw 'Avatar Lab startup is already running. Wait for that window.' }

    if (Test-Path -LiteralPath (Join-Path $projectRoot '.local/avatar-microphone-test/process.json')) {
        & (Join-Path $PSScriptRoot 'stop-avatar-microphone-test.ps1')
    }
    & (Join-Path $PSScriptRoot 'stop-avatar-face-review-server.ps1')
    Ensure-Dependencies $pluginDirectory 'plugin'
    Ensure-Dependencies $hostDirectory 'host'
    $installedPlugin = Join-Path (Join-Path $hostDirectory 'node_modules') $pluginName
    $linkProbe = "const fs=require('fs'); if(fs.realpathSync(process.argv[1]).toLowerCase()!==fs.realpathSync(process.argv[2]).toLowerCase())process.exit(1)"
    & $nodePath -e $linkProbe $installedPlugin $pluginDirectory
    if ($LASTEXITCODE -ne 0) {
        Invoke-Step 'Reconnect the installed avatar to current local sources' $hostDirectory $npmPath @('ci', '--no-audit', '--fund=false', '--install-links=false')
        & $nodePath -e $linkProbe $installedPlugin $pluginDirectory
    }
    if ($LASTEXITCODE -ne 0) { throw 'The installed avatar is not linked to current local sources. Run npm ci --install-links=false in avatar-lab.' }

    $sourceBefore = Get-AvatarSourceFingerprint $projectRoot $pluginDirectory $hostDirectory
    Invoke-Step '[1/4] Build the current local avatar Plugin' $pluginDirectory $npmPath @('run', 'build')
    Invoke-Step '[2/4] Build the current simulation' $hostDirectory $npmPath @('run', 'build')
    Invoke-Step '[3/4] Validate the built Environment' $hostDirectory $cliPath @('validate', '--json')
    $sourceAfter = Get-AvatarSourceFingerprint $projectRoot $pluginDirectory $hostDirectory
    if ($sourceBefore.sha256 -ne $sourceAfter.sha256) { throw 'Project source changed while building. Run this launcher again after editing finishes.' }
    $pluginVersion = (Get-Content -LiteralPath (Join-Path $pluginDirectory 'al-amr.plugin.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
    $buildRecord = [ordered]@{ schemaVersion = 1; builtAt = [DateTime]::UtcNow.ToString('o'); mode = 'latest-local-worktree'; pluginVersion = $pluginVersion;
        sourceFingerprint = $sourceAfter.sha256; sourceFiles = $sourceAfter.files;
        hostEntrySha256 = (Get-FileHash -LiteralPath (Join-Path $hostDirectory 'dist/index.html') -Algorithm SHA256).Hash.ToLowerInvariant();
        validated = $true; featureAcceptance = 'not_asserted'; published = $false }
    Write-AvatarLaunchRecord (Join-Path $stateDirectory 'last-build.json') $buildRecord
    if ($BuildOnly) { Write-Host 'Latest local build is ready.' -ForegroundColor Green; exit 0 }
    # Reopening the installed Desktop normally activates its existing window.
    # The exact executable comes from its official generated CLI launcher.
    $launcherText = Get-Content -LiteralPath $cliPath -Raw
    $desktopMatch = [regex]::Match($launcherText, '(?m)^\s*"([^"]+\.exe)"\s+"?--cli')
    if ($desktopMatch.Success -and (Test-Path -LiteralPath $desktopMatch.Groups[1].Value)) {
        Start-Process -FilePath $desktopMatch.Groups[1].Value -WindowStyle Normal | Out-Null
    }
    Write-Host "`nKeep Al-Amr visible while its models load. Use the view and hand controls in the panel." -ForegroundColor Yellow
    Write-Host "`n[4/4] Open this build in Al-Amr (local preview)" -ForegroundColor Cyan
    $preview = Invoke-AvatarPreviewReady -Invoke { Invoke-PreviewAttempt } -Delay {
        param($Milliseconds)
        Write-Host 'Waiting for Al-Amr Desktop to become ready...'
        Start-Sleep -Milliseconds $Milliseconds
    }
    $sourceOpened = Get-AvatarSourceFingerprint $projectRoot $pluginDirectory $hostDirectory
    if ($sourceOpened.sha256 -ne $sourceAfter.sha256) { throw 'Project source changed while opening the preview. Run this launcher again after editing finishes.' }
    $successRecord = [ordered]@{}
    foreach ($key in $buildRecord.Keys) { $successRecord[$key] = $buildRecord[$key] }
    $successRecord['openedAt'] = [DateTime]::UtcNow.ToString('o')
    $successRecord['previewReady'] = $true
    $successRecord['previewId'] = $preview.data.previewId
    $successRecord['buildDigest'] = $preview.data.buildDigest
    $successRecord['environmentId'] = $preview.data.product.id
    Write-AvatarLaunchRecord (Join-Path $stateDirectory 'last-success.json') $successRecord
    Write-Host ('Plugin ' + $pluginVersion + ' | ' + $preview.data.previewId) -ForegroundColor Green
    Write-Host ('Build: ' + $preview.data.buildDigest)
    Write-Host 'Avatar Studio is ready: one current avatar, hand controls and live resource monitoring.' -ForegroundColor Green
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Add-Content -LiteralPath $logPath -Encoding UTF8 -Value $_.Exception.Message
    exit 1
} finally {
    if ($ownsMutex -and $null -ne $mutex) { $mutex.ReleaseMutex() }
    if ($null -ne $mutex) { $mutex.Dispose() }
}
