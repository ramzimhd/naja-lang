[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$RequirementId,
    [Parameter(Mandatory)][string]$Target,
    [Parameter(Mandatory)][ValidatePattern('^[a-z0-9-]+$')][string]$Name,
    [Parameter(Mandatory)][string]$Tool,
    [ValidatePattern('^[0-9]+\.[0-9]+$')][string]$ContractRevision = '1.3',
    [string[]]$ToolArguments = @()
)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $root
try {
    $requirements = Get-Content planning/requirements.json -Raw | ConvertFrom-Json
    if ($RequirementId -notin $requirements.requirements.id) { throw 'Unknown requirement ID' }
    $commit = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot identify source commit' }
    $trackedChanges = & git status --porcelain --untracked-files=no
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect tracked source' }
    $untracked = @(& git ls-files --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect untracked source' }
    $hiddenIndexEntries = @(& git ls-files -v | Where-Object { $_ -cmatch '^[a-zS] ' })
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect index visibility flags' }
    if ($hiddenIndexEntries) { throw 'Hidden index entries require manual reconciliation before recording checks' }
    if ($trackedChanges -or ($untracked | Where-Object { -not $_.StartsWith('reports/checks/') })) {
        throw 'Commit source changes before recording checks; only new reports/checks artifacts may be untracked'
    }
    $directory = Join-Path $root 'reports/checks'
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    $logPath = Join-Path $directory "$Name.log"
    $evidencePath = Join-Path $directory "$Name.json"
    if ((Test-Path -LiteralPath $logPath) -or (Test-Path -LiteralPath $evidencePath)) {
        throw 'Evidence name already exists; use a new name to retain previous results'
    }
    $timestamp = [DateTimeOffset]::UtcNow.ToString('o')
    $captured = (& $Tool @ToolArguments 2>&1 | Out-String)
    $code = $LASTEXITCODE
    if ($null -eq $code) { throw 'Command did not provide a process exit code' }
    $sanitized = $captured.Replace($root, '<workspace>').Replace($root.Replace('\','/'), '<workspace>')
    if ($env:USERPROFILE) { $sanitized = $sanitized.Replace($env:USERPROFILE, '<user>').Replace($env:USERPROFILE.Replace('\','/'), '<user>') }
    $log = "Recorded command: $Tool $($ToolArguments -join ' ')`nRecorded exit code: $code`n--- captured output ---`n$sanitized"
    $logStream = [System.IO.File]::Open($logPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write)
    try {
        $logBytes = [System.Text.UTF8Encoding]::new($false).GetBytes($log)
        $logStream.Write($logBytes)
        $logStream.Flush($true)
    } finally { $logStream.Dispose() }
    $record = [ordered]@{
        contract_revision = $ContractRevision
        requirement_id = $RequirementId
        commit = $commit
        target = $Target
        command = @($Tool) + $ToolArguments
        tool_versions = @{
            powershell = $PSVersionTable.PSVersion.ToString()
            rustc = (& rustc --version | Out-String).Trim()
            cargo = (& cargo --version | Out-String).Trim()
            node = (& node --version | Out-String).Trim()
            git = (& git --version | Out-String).Trim()
        }
        exit_code = [int]$code
        result = $(if ($code -eq 0) { 'passed' } else { 'failed' })
        timestamp = $timestamp
        log_path = "reports/checks/$Name.log"
        log_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $logPath).Hash.ToLowerInvariant()
        limitations = @(
            'This check covers only the command and target recorded here; requirement completion requires its full acceptance criteria.',
            'Logs sanitize local workspace and user paths. No claim of a clean-room host, full HATCH acceptance or human productivity follows.'
        )
    }
    # A successful child cannot establish proof for a source it changed. This is
    # an endpoint check, not a continuous filesystem monitor or a sandbox.
    $endCommit = (& git rev-parse HEAD | Out-String).Trim()
    $headReadable = $LASTEXITCODE -eq 0
    $endTrackedChanges = @(& git status --porcelain --untracked-files=no)
    $trackedReadable = $LASTEXITCODE -eq 0
    $endUntracked = @(& git ls-files --others --exclude-standard)
    $untrackedReadable = $LASTEXITCODE -eq 0
    $endHiddenEntries = @(& git ls-files -v | Where-Object { $_ -cmatch '^[a-zS] ' })
    $indexReadable = $LASTEXITCODE -eq 0
    $sourceStable = $headReadable -and $trackedReadable -and $untrackedReadable -and $indexReadable -and
        ($endCommit -ceq $commit) -and (-not $endTrackedChanges) -and (-not $endHiddenEntries) -and
        (-not ($endUntracked | Where-Object { -not $_.StartsWith('reports/checks/') }))
    if (-not $sourceStable) {
        $record.result = 'failed'
        $record.limitations += 'Source or index changed, became hidden, or could not be inspected while recording. The child exit code is retained, but this is not passed evidence for the starting commit.'
    }
    $record.limitations += 'Source identity and visible cleanliness were checked at command boundaries; transient changes that were fully restored are not detected.'
    $json = ($record | ConvertTo-Json -Depth 8).Replace("`r`n", "`n") + "`n"
    $evidenceStream = [System.IO.File]::Open($evidencePath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write)
    try {
        $evidenceBytes = [System.Text.UTF8Encoding]::new($false).GetBytes($json)
        $evidenceStream.Write($evidenceBytes)
        $evidenceStream.Flush($true)
    } finally { $evidenceStream.Dispose() }
    Write-Output "$Name child_exit=$code source_stable=$sourceStable evidence=reports/checks/$Name.json"
    if (-not $sourceStable) { exit 1 }
    exit $code
} finally { Pop-Location }
