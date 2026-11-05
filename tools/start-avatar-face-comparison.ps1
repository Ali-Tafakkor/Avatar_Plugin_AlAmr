[CmdletBinding()]
param([switch]$BuildOnly)
# Compatibility entry: the accepted face is now the single primary avatar.
& (Join-Path $PSScriptRoot 'start-avatar-lab.ps1') -BuildOnly:$BuildOnly
exit $LASTEXITCODE
