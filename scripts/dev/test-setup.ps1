<#
.SYNOPSIS
Verify setup on an already sufficient Windows seed, without installing tools.
.DESCRIPTION
Uses temporary manifest copies for negative tests. The read-only real seed check
must pass before exercising the install no-op. Exit 0: all six checks passed;
exit 1: precondition/check failed. Does not modify shared toolchains or policies.
#>
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$testRoot = $null

function Assert-Status([string]$Name, [int]$Expected, [int]$Actual) {
    if ($Actual -ne $Expected) { throw "$Name expected exit $Expected; actual $Actual." }
    Write-Output "[PASS] $Name expected=$Expected actual=$Actual"
}

try {
    $root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
    $setup = Join-Path $PSScriptRoot 'setup.ps1'
    $baselineOutput = @(& $setup -Diagnostic)
    Assert-Status 'real-seed-check' 0 $LASTEXITCODE
    $manifestText = Get-Content -Raw -LiteralPath (Join-Path $root 'bootstrap/toolchains.json')
    $manifest = $manifestText | ConvertFrom-Json
    $tempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $testRoot = Join-Path $tempParent ('naja-setup-tests-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path (Join-Path $testRoot 'scripts/dev'), (Join-Path $testRoot 'bootstrap') | Out-Null
    Copy-Item -LiteralPath $setup -Destination (Join-Path $testRoot 'scripts/dev/setup.ps1')
    $fixtureSetup = Join-Path $testRoot 'scripts/dev/setup.ps1'
    $fixtureManifest = Join-Path $testRoot 'bootstrap/toolchains.json'

    $manifestText.Replace('"cargo_version": "' + $manifest.cargo_version + '"', '"cargo_version": "99.0.0"') | Set-Content -LiteralPath $fixtureManifest -Encoding utf8
    $testOutput = @(& $fixtureSetup)
    Assert-Status 'reject-wrong-cargo-pin' 1 $LASTEXITCODE
    if (($testOutput -join "`n") -notmatch 'cargo did not report exact version 99.0.0') { throw 'Wrong Cargo pin did not identify its failure.' }

    $manifestText.Replace('"rust_version": "' + $manifest.rust_version + '"', '"rust_version": "latest"') | Set-Content -LiteralPath $fixtureManifest -Encoding utf8
    $testOutput = @(& $fixtureSetup 2>&1)
    Assert-Status 'reject-malformed-pin' 2 $LASTEXITCODE

    $manifestText.Replace('"rust_version": "' + $manifest.rust_version + '"', '"rust_version": "9.99.0"').Replace('channel-rust-' + $manifest.rust_version + '.toml', 'channel-rust-9.99.0.toml') | Set-Content -LiteralPath $fixtureManifest -Encoding utf8
    $beforeToolchains = @(rustup toolchain list)
    $testOutput = @(& $fixtureSetup -Install -DryRun)
    Assert-Status 'missing-exact-toolchain-dry-run' 1 $LASTEXITCODE
    if (($testOutput -join "`n") -notmatch 'no compiler proxy was invoked') { throw 'Missing-toolchain check did not report its safe path.' }
    $afterToolchains = @(rustup toolchain list)
    if (Compare-Object $beforeToolchains $afterToolchains) { throw 'Dry-run changed the toolchain inventory.' }

    $rustupRoot = if ($env:RUSTUP_HOME) { $env:RUSTUP_HOME } else { Join-Path $env:USERPROFILE '.rustup' }
    $settings = Join-Path $rustupRoot 'settings.toml'
    $settingsHash = (Get-FileHash -LiteralPath $settings -Algorithm SHA256).Hash
    $testOutput = @(& $setup -Install)
    Assert-Status 'sufficient-install-no-op' 0 $LASTEXITCODE
    if (($testOutput -join "`n") -match '\[PLAN\]') { throw 'Sufficient environment unexpectedly planned an installation.' }
    $afterToolchains = @(rustup toolchain list)
    if ((Compare-Object $beforeToolchains $afterToolchains) -or $settingsHash -ne (Get-FileHash -LiteralPath $settings -Algorithm SHA256).Hash) { throw 'Install no-op changed rustup settings/toolchain inventory.' }
    Write-Output '[PASS] rustup-settings-and-inventory-unchanged'
    Write-Output 'All six Windows setup checks passed. Native linking and product acceptance are separate checks.'
    exit 0
} catch {
    Write-Error -ErrorAction Continue "Setup verification failed: $($_.Exception.Message)"
    exit 1
} finally {
    if ($null -ne $testRoot -and (Test-Path -LiteralPath $testRoot)) {
        $resolvedTestRoot = [IO.Path]::GetFullPath($testRoot)
        $resolvedParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
        if (-not $resolvedTestRoot.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolvedTestRoot) -notmatch '^naja-setup-tests-[a-f0-9]{32}$') { throw 'Temporary cleanup target failed workspace-boundary validation.' }
        Remove-Item -LiteralPath $resolvedTestRoot -Recurse
    }
}
