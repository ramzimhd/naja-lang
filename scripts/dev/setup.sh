#!/usr/bin/env bash
# Read-only by default. No JSON runtime, Python, elevation, or remote shell pipe.
# Exit codes: 0 selected checks passed; 1 tools missing/mismatched/blocked;
# 2 invalid input, unsupported host, or installation/provenance failure.
set -eu

scope=seed
diagnostic=0
dry_run=0
install=0
failures=0
usage() {
    printf '%s\n' 'Usage: bash scripts/dev/setup.sh [--scope seed|extension|all] [--diagnostic] [--dry-run] [--install]'
}
while [ "$#" -gt 0 ]; do
    case "$1" in
        --scope) [ "$#" -ge 2 ] || { usage >&2; exit 2; }; scope=$2; shift ;;
        --diagnostic) diagnostic=1 ;;
        --dry-run) dry_run=1 ;;
        --install) install=1 ;;
        --help|-h) usage; exit 0 ;;
        *) usage >&2; exit 2 ;;
    esac
    shift
done
case "$scope" in seed|extension|all) ;; *) usage >&2; exit 2 ;; esac
script_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root=$(CDPATH= cd -- "$script_dir/../.." && pwd)
manifest=$root/bootstrap/toolchains.json

# Schema 1 deliberately keeps consumed scalars on individual JSON lines, without
# JSON escapes. This restricted reader neither evaluates nor sources file text.
manifest_value() {
    value=$(sed -nE "s/^[[:space:]]*\"$1\"[[:space:]]*:[[:space:]]*\"([^\"\\\\]*)\"[,]?[[:space:]]*$/\1/p" "$manifest")
    [ -n "$value" ] && [ "$(printf '%s\n' "$value" | wc -l | tr -d ' ')" = 1 ] || { printf 'Invalid/missing manifest field: %s\n' "$1" >&2; exit 2; }
    printf '%s' "$value"
}
[ "$(sed -nE 's/^[[:space:]]*"schema_version"[[:space:]]*:[[:space:]]*([0-9]+),?[[:space:]]*$/\1/p' "$manifest")" = 1 ] || { printf '%s\n' 'Unsupported manifest schema.' >&2; exit 2; }
rust_version=$(manifest_value rust_version)
cargo_version=$(manifest_value cargo_version)
git_version=$(manifest_value git_version)
node_version=$(manifest_value node_version)
npm_version=$(manifest_value npm_version)
code_version=$(manifest_value code_version)
gh_version=$(manifest_value gh_version)
for version in "$rust_version" "$cargo_version" "$git_version" "$node_version" "$npm_version" "$code_version" "$gh_version"; do
    [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { printf '%s\n' 'Invalid exact version in manifest.' >&2; exit 2; }
done
[ "$(manifest_value rust_profile)" = minimal ] && [ "$(manifest_value rust_components)" = rustfmt,clippy ] || { printf '%s\n' 'Unsupported Rust profile/components.' >&2; exit 2; }
manifest_url=$(manifest_value rust_manifest_url)
manifest_hash=$(manifest_value rust_manifest_sha256)
[ "$manifest_url" = "https://static.rust-lang.org/dist/channel-rust-$rust_version.toml" ] && [[ "$manifest_hash" =~ ^[a-f0-9]{64}$ ]] || { printf '%s\n' 'Invalid Rust release provenance.' >&2; exit 2; }
case "$(uname -s):$(uname -m)" in
    Linux:x86_64) host=x86_64-unknown-linux-gnu ;;
    Darwin:arm64) host=aarch64-apple-darwin ;;
    *) printf '%s\n' 'setup.sh supports Linux x64/macOS arm64; use setup.ps1 on Windows x64.' >&2; exit 2 ;;
esac
toolchain=$rust_version-$host
mode=check
[ "$install" = 0 ] || mode=install
[ "$dry_run" = 0 ] || mode=dry-run
printf 'NAJA setup scope=%s host=%s mode=%s\n' "$scope" "$host" "$mode"
fail() { printf '[FAIL] %s\n' "$1"; failures=$((failures + 1)); }
tool_path() {
    path=$(command -v "$1" 2>/dev/null) || return 1
    # WSL Windows interop commands do not verify native Linux tooling.
    case "$path" in /mnt/[a-z]/*) return 1 ;; esac
    if [ "$diagnostic" = 1 ]; then printf '[PATH] %s %s\n' "$1" "$path" >&2; fi
    printf '%s' "$path"
}
check_version() {
    name=$1 expected=$2 pattern=$3
    if ! path=$(tool_path "$name"); then fail "$name missing for native $host; expected $expected"; return; fi
    if ! output=$("$path" --version 2>&1); then fail "$name execution failed or was blocked; expected $expected"; return; fi
    actual=$(printf '%s\n' "$output" | sed -nE "$pattern" | head -n 1)
    if [ "$actual" != "$expected" ]; then fail "$name expected=$expected actual=${actual:-unrecognized}; existing installation preserved"; return; fi
    printf '[OK] %s %s\n' "$name" "$actual"
}
rustup_path=$(tool_path rustup) || rustup_path=
installed=0
components_ready=0
components_present() {
    components=$("$rustup_path" component list --installed --toolchain "$toolchain" 2>/dev/null) || return 1
    printf '%s\n' "$components" | grep -qx "rustfmt-$host" && printf '%s\n' "$components" | grep -qx "clippy-$host"
}
if [ -n "$rustup_path" ]; then
    toolchains=$("$rustup_path" toolchain list 2>/dev/null) || toolchains=
    if printf '%s\n' "$toolchains" | awk -v required="$toolchain" '$1 == required { found=1 } END { exit !found }'; then
        installed=1
        if components_present; then components_ready=1; fi
    fi
fi
if [ "$installed" = 0 ] || [ "$components_ready" = 0 ]; then
    if [ "$installed" = 1 ]; then
        printf '[PLAN] rustup component add rustfmt clippy --toolchain %s\n' "$toolchain"
    else
        printf '[PLAN] rustup toolchain install %s --profile minimal --component rustfmt --component clippy --no-self-update --no-update\n' "$toolchain"
    fi
    if [ "$install" = 1 ] && [ "$dry_run" = 0 ]; then
        [ -n "$rustup_path" ] || { printf '%s\n' 'Install rustup from https://www.rust-lang.org/tools/install after inspecting/verifying the official installer; rerun setup. No installer was executed.' >&2; exit 2; }
        [ "${RUSTUP_DIST_SERVER:-https://static.rust-lang.org}" = https://static.rust-lang.org ] && [ "${RUSTUP_UPDATE_ROOT:-https://static.rust-lang.org/rustup}" = https://static.rust-lang.org/rustup ] || { printf '%s\n' 'Custom rustup distribution/update endpoints require a separate provenance review.' >&2; exit 2; }
        command -v curl >/dev/null 2>&1 || { printf '%s\n' 'curl is required to verify the official manifest before installation.' >&2; exit 2; }
        if command -v sha256sum >/dev/null 2>&1; then hash_tool=sha256sum; elif command -v shasum >/dev/null 2>&1; then hash_tool=shasum; else printf '%s\n' 'sha256sum or shasum is required for release integrity verification.' >&2; exit 2; fi
        manifest_file=$(mktemp "${TMPDIR:-/tmp}/naja-rust-manifest.XXXXXXXX") || exit 2
        trap 'rm -f -- "$manifest_file"' EXIT
        curl --fail --silent --show-error --proto '=https' --tlsv1.2 "$manifest_url" -o "$manifest_file" || exit 2
        if [ "$hash_tool" = sha256sum ]; then actual_hash=$(sha256sum "$manifest_file"); else actual_hash=$(shasum -a 256 "$manifest_file"); fi
        actual_hash=${actual_hash%% *}
        [ "$actual_hash" = "$manifest_hash" ] || { printf '%s\n' 'Official Rust release manifest checksum mismatch; no installation attempted.' >&2; exit 2; }
        if [ "$installed" = 1 ]; then
            "$rustup_path" component add rustfmt clippy --toolchain "$toolchain" || exit 2
        else
            "$rustup_path" toolchain install "$toolchain" --profile minimal --component rustfmt --component clippy --no-self-update --no-update || exit 2
        fi
        installed=1
        if components_present; then components_ready=1; fi
    fi
fi
if [ "$installed" = 0 ]; then
    fail "Exact Rust toolchain $toolchain is not installed; no compiler proxy was invoked. Official rustup: https://www.rust-lang.org/tools/install"
else
    for name in rustc cargo; do
        expected=$rust_version
        [ "$name" != cargo ] || expected=$cargo_version
        reported=
        if output=$("$rustup_path" run "$toolchain" "$name" --version 2>&1); then
            case "$output" in "$name "*) reported=${output#"$name "}; reported=${reported%% *} ;; esac
        fi
        if [ "$reported" = "$expected" ]; then
            printf '[OK] %s %s (%s)\n' "$name" "$expected" "$toolchain"
        else
            fail "$name did not report exact version $expected"
        fi
    done
    if [ "$components_ready" = 1 ]; then printf '%s\n' '[OK] Rust components rustfmt,clippy'; else fail 'Pinned Rust components rustfmt/clippy are missing or unreadable'; fi
fi
check_version git "$git_version" 's/^git version ([0-9]+\.[0-9]+\.[0-9]+)([.][^[:space:]]+)?([[:space:]].*)?$/\1/p'
if [ "$scope" = extension ] || [ "$scope" = all ]; then
    check_version node "$node_version" 's/^v([0-9]+\.[0-9]+\.[0-9]+)$/\1/p'
    check_version npm "$npm_version" 's/^([0-9]+\.[0-9]+\.[0-9]+)$/\1/p'
    check_version code "$code_version" 's/^([0-9]+\.[0-9]+\.[0-9]+)$/\1/p'
fi
if [ "$scope" = all ]; then check_version gh "$gh_version" 's/^gh version ([0-9]+\.[0-9]+\.[0-9]+)([[:space:]].*)?$/\1/p'; fi
printf '%s\n' '[NOTE] Missing/mismatched Git, Node/npm, VS Code or gh requires a separately reviewed official installation; setup preserves existing tools. See bootstrap/toolchains.json and docs/decisions/0001-seed-toolchain.md.'
[ "$failures" = 0 ] || exit 1
