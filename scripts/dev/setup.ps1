<#
.SYNOPSIS
Check the pinned NAJA seed tools; optionally add the exact Rust toolchain.
.DESCRIPTION
Read-only by default. Diagnostic prints command paths. DryRun prints repair
commands without executing them. Install only uses an existing rustup and never
changes its default, removes tools, elevates, or changes host security policy.
Exit codes: 0 selected checks passed; 1 missing/mismatched/blocked tools;
2 invalid arguments, manifest, host, or failed installation.
#>
[CmdletBinding()]
param(
    [ValidateSet('Seed', 'Extension', 'All')]
    [string]$Scope = 'Seed',
    [switch]$Diagnostic,
    [switch]$DryRun,
    [switch]$Install
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$script:Failures = 0

function Report-Failure([string]$Message) {
    Write-Output "[FAIL] $Message"
    $script:Failures++
}

function Find-Tool([string]$Name) {
    $command = Get-Command $Name -CommandType Application, ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $command -and $Diagnostic) { Write-Host "[PATH] $Name $($command.Source)" }
    return $command
}

function Probe([string]$Program, [string[]]$Arguments) {
    try {
        $output = @(& $Program @Arguments 2>&1)
        $succeeded = $?
        $exitCode = $LASTEXITCODE
        if (-not $succeeded -or $exitCode -ne 0) { return $null }
        return ($output -join "`n")
    } catch {
        if ($Diagnostic) { Write-Host "[BLOCKED] Command could not execute: $Program. $($_.Exception.Message)" }
        return $null
    }
}

function Check-Version([string]$Name, [string]$Expected, [string]$Pattern, [string[]]$Arguments) {
    $command = Find-Tool $Name
    if ($null -eq $command) { Report-Failure "$Name missing; expected $Expected"; return }
    $output = Probe $command.Source $Arguments
    if ($null -eq $output) { Report-Failure "$Name execution failed or was blocked; expected $Expected"; return }
    $match = [regex]::Match($output, $Pattern)
    if (-not $match.Success) { Report-Failure "$Name returned an unrecognized version"; return }
    $actual = $match.Groups[1].Value
    if ($actual -ne $Expected) { Report-Failure "$Name expected=$Expected actual=$actual; existing installation preserved"; return }
    Write-Output "[OK] $Name $actual"
}

try {
    $root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
    $manifest = Get-Content -Raw -LiteralPath (Join-Path $root 'bootstrap/toolchains.json') | ConvertFrom-Json
    if ($manifest.schema_version -ne 1) { throw 'Unsupported toolchain manifest schema.' }
    foreach ($field in @('rust_version', 'cargo_version', 'git_version', 'node_version', 'npm_version', 'code_version', 'gh_version')) {
        if ($manifest.$field -notmatch '^\d+\.\d+\.\d+$') { throw "Invalid exact version in $field." }
    }
    if ($manifest.rust_profile -ne 'minimal' -or $manifest.rust_components -ne 'rustfmt,clippy') { throw 'Unsupported Rust profile/components.' }
    $expectedUrl = "https://static.rust-lang.org/dist/channel-rust-$($manifest.rust_version).toml"
    if ($manifest.rust_manifest_url -ne $expectedUrl -or $manifest.rust_manifest_sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Invalid Rust release provenance.' }
    $architecture = $env:PROCESSOR_ARCHITECTURE
    if ($env:PROCESSOR_ARCHITEW6432) { $architecture = $env:PROCESSOR_ARCHITEW6432 }
    if ($env:OS -ne 'Windows_NT' -or $architecture -ne 'AMD64') { throw 'setup.ps1 supports Windows x64; use setup.sh on Linux x64/macOS arm64.' }
    $hostTarget = 'x86_64-pc-windows-msvc'
    $toolchain = "$($manifest.rust_version)-$hostTarget"
    Write-Output "NAJA setup scope=$Scope host=$hostTarget mode=$(if ($DryRun) { 'dry-run' } elseif ($Install) { 'install' } else { 'check' })"
    $rustup = Find-Tool 'rustup'
    $installed = $false
    $componentsReady = $false
    if ($null -ne $rustup) {
        $toolchains = Probe $rustup.Source @('toolchain', 'list')
        $installed = $null -ne $toolchains -and $toolchains -match "(?m)^$([regex]::Escape($toolchain))(?:\s|$)"
        if ($installed) {
            $components = Probe $rustup.Source @('component', 'list', '--installed', '--toolchain', $toolchain)
            $componentsReady = $null -ne $components
            foreach ($component in $manifest.rust_components.Split(',')) {
                $componentsReady = $componentsReady -and $components -match "(?m)^$component-$hostTarget(?:\s|$)"
            }
        }
    }
    $repair = if ($installed) { "rustup component add rustfmt clippy --toolchain $toolchain" } else { "rustup toolchain install $toolchain --profile minimal --component rustfmt --component clippy --no-self-update --no-update" }
    if (-not $installed -or -not $componentsReady) {
        Write-Output "[PLAN] $repair"
        if ($Install -and -not $DryRun) {
            if ($null -eq $rustup) { throw 'Install rustup from https://www.rust-lang.org/tools/install after inspecting/verifying the official installer; rerun setup. No installer was executed.' }
            if (($env:RUSTUP_DIST_SERVER -and $env:RUSTUP_DIST_SERVER -ne 'https://static.rust-lang.org') -or ($env:RUSTUP_UPDATE_ROOT -and $env:RUSTUP_UPDATE_ROOT -ne 'https://static.rust-lang.org/rustup')) { throw 'Custom rustup distribution/update endpoints require a separate provenance review.' }
            $response = Invoke-WebRequest -UseBasicParsing -Uri $expectedUrl
            $bytes = $response.Content
            if ($bytes -is [string]) { $bytes = [System.Text.Encoding]::UTF8.GetBytes($bytes) }
            $hasher = [System.Security.Cryptography.SHA256]::Create()
            try { $digest = [BitConverter]::ToString($hasher.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant() } finally { $hasher.Dispose() }
            if ($digest -ne $manifest.rust_manifest_sha256) { throw 'Official Rust release manifest checksum mismatch; no installation attempted.' }
            if ($installed) {
                & $rustup.Source component add rustfmt clippy --toolchain $toolchain
            } else {
                & $rustup.Source toolchain install $toolchain --profile minimal --component rustfmt --component clippy --no-self-update --no-update
            }
            if ($LASTEXITCODE -ne 0) { throw 'rustup could not install the pinned toolchain/components.' }
            $installed = $true
            $components = Probe $rustup.Source @('component', 'list', '--installed', '--toolchain', $toolchain)
            $componentsReady = $null -ne $components
            foreach ($component in $manifest.rust_components.Split(',')) {
                $componentsReady = $componentsReady -and $components -match "(?m)^$component-$hostTarget(?:\s|$)"
            }
        }
    }
    if (-not $installed) {
        Report-Failure "Exact Rust toolchain $toolchain is not installed; no compiler proxy was invoked. Official rustup: https://www.rust-lang.org/tools/install"
    } else {
        foreach ($item in @(@('rustc', $manifest.rust_version), @('cargo', $manifest.cargo_version))) {
            $output = Probe $rustup.Source @('run', $toolchain, $item[0], '--version')
            if ($null -eq $output -or $output -notmatch "^$($item[0]) $([regex]::Escape($item[1]))(?:\s|$)") { Report-Failure "$($item[0]) did not report exact version $($item[1])" } else { Write-Output "[OK] $($item[0]) $($item[1]) ($toolchain)" }
        }
        if ($componentsReady) { Write-Output '[OK] Rust components rustfmt,clippy' } else { Report-Failure 'Pinned Rust components rustfmt/clippy are missing or unreadable' }
    }
    Check-Version 'git' $manifest.git_version '(?m)^git version (\d+\.\d+\.\d+)(?:\.[^\s]+)?(?:\s|$)' @('--version')
    if ($Scope -in @('Extension', 'All')) {
        Check-Version 'node' $manifest.node_version '(?m)^v(\d+\.\d+\.\d+)(?:\s|$)' @('--version')
        Check-Version 'npm' $manifest.npm_version '(?m)^(\d+\.\d+\.\d+)(?:\s|$)' @('--version')
        Check-Version 'code' $manifest.code_version '(?m)^(\d+\.\d+\.\d+)(?:\s|$)' @('--version')
    }
    if ($Scope -eq 'All') { Check-Version 'gh' $manifest.gh_version '(?m)^gh version (\d+\.\d+\.\d+)(?:\s|$)' @('--version') }
    Write-Output '[NOTE] Missing/mismatched Git, Node/npm, VS Code or gh requires a separately reviewed official installation; setup preserves existing tools. See bootstrap/toolchains.json and docs/decisions/0001-seed-toolchain.md.'
    if ($script:Failures -gt 0) { exit 1 }
    exit 0
} catch {
    Write-Error -ErrorAction Continue "Setup stopped: $($_.Exception.Message)"
    exit 2
}
