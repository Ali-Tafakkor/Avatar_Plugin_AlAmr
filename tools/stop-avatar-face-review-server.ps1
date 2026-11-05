[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$reviewWorkspace=Split-Path -Parent $PSScriptRoot
$reviewStatePath=Join-Path $reviewWorkspace '.local/face-inspiration/process.json'
if(-not(Test-Path -LiteralPath $reviewStatePath)){return}
$reviewState=Get-Content -LiteralPath $reviewStatePath -Raw -Encoding UTF8|ConvertFrom-Json
$expectedReview=Join-Path $reviewWorkspace 'avatar-lab\experiments\face-inspiration'
if([IO.Path]::GetFullPath($reviewState.project) -ne [IO.Path]::GetFullPath($expectedReview)){throw 'Unexpected face review server project.'}
$reviewProcess=Get-Process -Id $reviewState.processId -ErrorAction SilentlyContinue
if($reviewProcess){
  $reviewCommand=Get-CimInstance Win32_Process -Filter ('ProcessId='+$reviewState.processId)
  $reviewVite=Join-Path $reviewWorkspace 'avatar-lab\node_modules\vite\bin\vite.js'
  $reviewStart=if($reviewState.startedAt -is [DateTime]){$reviewState.startedAt.ToUniversalTime()}else{[DateTimeOffset]::Parse([string]$reviewState.startedAt).UtcDateTime}
  if(-not $reviewCommand -or [Math]::Abs(($reviewProcess.StartTime.ToUniversalTime()-$reviewStart).TotalSeconds) -gt 2 -or $reviewCommand.CommandLine.Replace('/','\').IndexOf($reviewVite,[StringComparison]::OrdinalIgnoreCase) -lt 0 -or $reviewCommand.CommandLine -notmatch '--port\s+5392\b'){throw 'Review process identity changed; nothing stopped.'}
  $reviewChildren=@(Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$reviewState.processId)|Where-Object {$_.ExecutablePath -and $_.ExecutablePath.Replace('/','\').StartsWith((Join-Path $reviewWorkspace 'avatar-lab\node_modules\'),[StringComparison]::OrdinalIgnoreCase) -and $_.Name -eq 'esbuild.exe'})
  Stop-Process -Id $reviewProcess.Id
  foreach($child in $reviewChildren){$live=Get-CimInstance Win32_Process -Filter ('ProcessId='+$child.ProcessId);if($live -and $live.CreationDate -eq $child.CreationDate){Stop-Process -Id $child.ProcessId -ErrorAction SilentlyContinue}}
  Write-Host 'Stopped the archived comparison server and its own esbuild helper.'
}
Remove-Item -LiteralPath $reviewStatePath
