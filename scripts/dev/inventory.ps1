[CmdletBinding()]
param([string]$OutputPath = (Join-Path $PSScriptRoot '../../launch/local/environment.json'))
$ErrorActionPreference = 'Stop'
function Read-Tool([string]$Name, [string[]]$VersionArguments) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) { return @{ available = $false; path = $null; version = $null; exit_code = $null } }
    $output = & $command.Source @VersionArguments 2>&1 | Out-String
    $resultCode = $LASTEXITCODE
    return @{ available = $true; path = $command.Source; version = $output.Trim(); exit_code = $resultCode }
}
$os = Get-CimInstance Win32_OperatingSystem
$disk = Get-PSDrive -Name ([System.IO.Path]::GetPathRoot($PSScriptRoot).TrimEnd(':\'))
$inventory = [ordered]@{
    schema_version = 1
    timestamp = [DateTimeOffset]::UtcNow.ToString('o')
    workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
    operating_system = @{ name = $os.Caption; version = $os.Version; architecture = $os.OSArchitecture }
    memory_bytes = [uint64]$os.TotalVisibleMemorySize * 1024
    free_disk_bytes = $disk.Free
    shell = $PSVersionTable.PSVersion.ToString()
    tools = [ordered]@{
        git = Read-Tool 'git' @('--version')
        github_cli = Read-Tool 'gh' @('--version')
        rust = Read-Tool 'rustc' @('--version', '--verbose')
        cargo = Read-Tool 'cargo' @('--version')
        node = Read-Tool 'node' @('--version')
        vscode = Read-Tool 'code' @('--version')
    }
    notes = @('Private host paths must not be published.', 'No tool installation, credential read or security change performed.', 'npm intentionally excluded after a separately observed endpoint-protection block in npm.ps1.')
}
$absoluteOutput = [System.IO.Path]::GetFullPath($OutputPath)
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($absoluteOutput)) | Out-Null
$inventory | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $absoluteOutput -Encoding utf8
Write-Output 'Private environment inventory written. Review and sanitize before publication.'
