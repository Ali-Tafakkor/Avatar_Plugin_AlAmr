[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$avatarRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $avatarRoot '.local/avatar-microphone-test/process.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Host 'No microphone preview has been started.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
$ownedProcess = Get-Process -Id $state.processId -ErrorAction SilentlyContinue
if ($ownedProcess) {
    $ownedCommand = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $state.processId)
    $expectedVite = [IO.Path]::GetFullPath((Join-Path $avatarRoot 'avatar-lab/node_modules/vite/bin/vite.js'))
    $recordedStart = if ($state.startedAt -is [DateTime]) { $state.startedAt.ToUniversalTime() } else { [DateTimeOffset]::Parse([string]$state.startedAt).UtcDateTime }
    $sameStart = [Math]::Abs(($ownedProcess.StartTime.ToUniversalTime() - $recordedStart).TotalSeconds) -lt 2
    if (-not $sameStart -or -not $ownedCommand -or $ownedCommand.CommandLine.Replace('/', '\').IndexOf($expectedVite,[StringComparison]::OrdinalIgnoreCase) -lt 0) { throw 'Process identity changed; no process was stopped.' }
    Stop-Process -Id $ownedProcess.Id
    Wait-Process -Id $ownedProcess.Id -Timeout 5 -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 300
}
Remove-Item -LiteralPath $statePath
Write-Host 'The local microphone preview server stopped. Close its browser tab.' -ForegroundColor Green
