[CmdletBinding()]
param([switch]$BuildOnly)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
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
    if ($installed -and -not $stampExists) {
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
    $mutexId = (Get-FileHash -LiteralPath (Join-Path $hostDirectory 'package-lock.json') -Algorithm SHA256).Hash.Substring(0,24)
    $mutex = New-Object System.Threading.Mutex($false, ('Local\AvatarLab-' + $mutexId))
    $ownsMutex = $mutex.WaitOne(0)
    if (-not $ownsMutex) { throw 'Avatar Lab startup is already running. Wait for that window.' }

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

    Invoke-Step '[1/4] Build the current local avatar Plugin' $pluginDirectory $npmPath @('run', 'build')
    Invoke-Step '[2/4] Build the current simulation' $hostDirectory $npmPath @('run', 'build')
    Invoke-Step '[3/4] Validate the built Environment' $hostDirectory $cliPath @('validate', '--json')
    if ($BuildOnly) { Write-Host 'Latest local build is ready.' -ForegroundColor Green; exit 0 }
    # Reopening the installed Desktop normally activates its existing window.
    # The exact executable comes from its official generated CLI launcher.
    $launcherText = Get-Content -LiteralPath $cliPath -Raw
    $desktopMatch = [regex]::Match($launcherText, '(?m)^\s*"([^"]+\.exe)"\s+"?--cli')
    if ($desktopMatch.Success -and (Test-Path -LiteralPath $desktopMatch.Groups[1].Value)) {
        Start-Process -FilePath $desktopMatch.Groups[1].Value -WindowStyle Normal | Out-Null
    }
    Write-Host "`nKeep Al-Amr visible while its models load. H = film view; Esc = controls." -ForegroundColor Yellow
    Invoke-Step '[4/4] Open this build in Al-Amr (local preview)' $hostDirectory $cliPath @('dev', '--json')
    Write-Host 'Avatar Lab is ready. H = film view; Esc = controls; R = reset; V = switch avatar.' -ForegroundColor Green
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Add-Content -LiteralPath $logPath -Encoding UTF8 -Value $_.Exception.Message
    exit 1
} finally {
    if ($ownsMutex -and $null -ne $mutex) { $mutex.ReleaseMutex() }
    if ($null -ne $mutex) { $mutex.Dispose() }
}
