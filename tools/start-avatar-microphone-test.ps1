[CmdletBinding()]
param([switch]$NoBuild, [switch]$NoOpen)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$avatarRoot = Split-Path -Parent $PSScriptRoot
$labRoot = Join-Path $avatarRoot 'avatar-lab'
$stateRoot = Join-Path $avatarRoot '.local/avatar-microphone-test'
$statePath = Join-Path $stateRoot 'process.json'
New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null
if (-not $NoBuild) {
    # Vite preview holds the host esbuild binary on Windows. Release this
    # project's own server before any locked dependency installation/build.
    & (Join-Path $PSScriptRoot 'stop-avatar-microphone-test.ps1')
    & (Join-Path $PSScriptRoot 'start-avatar-lab.ps1') -BuildOnly
    if ($LASTEXITCODE -ne 0) { throw 'Avatar build failed.' }
}
$vitePath = [IO.Path]::GetFullPath((Join-Path $labRoot 'node_modules/vite/bin/vite.js'))
$previewUrl = 'http://127.0.0.1:5390/'
$existingPreview = $false
if (Test-Path -LiteralPath $statePath) {
    $oldState = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    $oldProcess = Get-Process -Id $oldState.processId -ErrorAction SilentlyContinue
    if ($oldProcess) {
        $oldCommand = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $oldState.processId)
        $recordedStart = if ($oldState.startedAt -is [DateTime]) { $oldState.startedAt.ToUniversalTime() } else { [DateTimeOffset]::Parse([string]$oldState.startedAt).UtcDateTime }
        $existingPreview = $oldCommand -and $oldCommand.CommandLine.Replace('/', '\').IndexOf($vitePath,[StringComparison]::OrdinalIgnoreCase) -ge 0 -and
            [Math]::Abs(($oldProcess.StartTime.ToUniversalTime() - $recordedStart).TotalSeconds) -lt 2
    }
}
if (-not $existingPreview) {
    if (Get-NetTCPConnection -LocalPort 5390 -State Listen -ErrorAction SilentlyContinue) {
        throw 'Port 5390 is occupied by another process. It was not stopped.'
    }
    $nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
    $previewProcess = Start-Process -FilePath $nodeExe -ArgumentList @(('"' + $vitePath + '"'), 'preview', '--host', '127.0.0.1', '--port', '5390', '--strictPort') -WorkingDirectory $labRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateRoot 'server.log') -RedirectStandardError (Join-Path $stateRoot 'server-error.log')
    $state = [pscustomobject]@{ processId = $previewProcess.Id; startedAt = $previewProcess.StartTime.ToUniversalTime().ToString('o'); project = $labRoot; url = $previewUrl }
    $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
}
$healthy = $false
for ($probe = 0; $probe -lt 40; $probe++) {
    try { $response = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200) { $healthy = $true; break } } catch {}
    Start-Sleep -Milliseconds 250
}
if (-not $healthy) { throw ('Local preview did not start. See ' + $stateRoot) }
Write-Host ('Avatar 0.1.3 microphone test: ' + $previewUrl) -ForegroundColor Green
if (-not $NoOpen) { Start-Process ($previewUrl + '?build=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) | Out-Null }
