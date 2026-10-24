#!/usr/bin/env bash
# Offline fixtures test setup logic, never Linux/macOS toolchain installation.
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root=$(CDPATH= cd -- "$script_dir/../.." && pwd)
case "$(uname -s):$(uname -m)" in
    Linux:x86_64) test_host=x86_64-unknown-linux-gnu ;;
    Darwin:arm64) test_host=aarch64-apple-darwin ;;
    *) printf '%s\n' 'Run this fixture suite on Linux x64 or macOS arm64.' >&2; exit 1 ;;
esac
temp_parent=$(CDPATH= cd -- "${TMPDIR:-/tmp}" && pwd)
fixture=$(mktemp -d "$temp_parent/naja-setup-tests.XXXXXXXX")
cleanup() {
    case "$fixture" in "$temp_parent"/naja-setup-tests.*) rm -rf -- "$fixture" ;; *) printf '%s\n' 'Temporary cleanup target failed boundary validation.' >&2; exit 1 ;; esac
}
trap cleanup EXIT
mkdir -p "$fixture/scripts/dev" "$fixture/bootstrap" "$fixture/bin"
cp "$script_dir/setup.sh" "$fixture/scripts/dev/setup.sh"
cp "$root/bootstrap/toolchains.json" "$fixture/bootstrap/toolchains.json"
cp "$fixture/bootstrap/toolchains.json" "$fixture/original.json"
cat > "$fixture/bin/rustup" <<'FIXTURE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$NAJA_TEST_CALLS"
case "$1:$2" in
    toolchain:list) printf '%s-%s\n' "${NAJA_TEST_TOOLCHAIN:-1.97.1}" "$NAJA_TEST_HOST" ;;
    component:list) printf 'rustfmt-%s\n' "$NAJA_TEST_HOST"; if [ "${NAJA_TEST_MISSING_COMPONENT:-0}" = 0 ]; then printf 'clippy-%s\n' "$NAJA_TEST_HOST"; fi ;;
    run:*) case "$3" in rustc) printf 'rustc %s (fixture)\n' "${NAJA_TEST_COMPILER:-1.97.1}" ;; cargo) printf 'cargo %s (fixture)\n' "${NAJA_TEST_CARGO:-1.97.1}" ;; *) exit 7 ;; esac ;;
    *) printf '%s\n' 'Unexpected mutation or command in fixture' >&2; exit 7 ;;
esac
FIXTURE
cat > "$fixture/bin/git" <<'FIXTURE'
#!/usr/bin/env bash
printf '%s\n' 'git version 2.51.0'
FIXTURE
cat > "$fixture/bin/curl" <<'FIXTURE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$NAJA_TEST_CURL_CALLS"
while [ "$#" -gt 0 ]; do if [ "$1" = -o ]; then printf '%s\n' 'Fixture metadata with a deliberately wrong checksum' > "$2"; exit 0; fi; shift; done
exit 7
FIXTURE
chmod +x "$fixture/bin/rustup" "$fixture/bin/git" "$fixture/bin/curl"
export PATH="$fixture/bin:$PATH"
export NAJA_TEST_HOST="$test_host"
export NAJA_TEST_CALLS="$fixture/rustup.calls"
export NAJA_TEST_CURL_CALLS="$fixture/curl.calls"
check() {
    expected=$1 name=$2
    shift 2
    set +e
    "$@" > "$fixture/$name.log" 2>&1
    actual=$?
    set -e
    if [ "$expected" != "$actual" ]; then printf '[FAIL] %s expected=%s actual=%s\n' "$name" "$expected" "$actual"; cat "$fixture/$name.log"; exit 1; fi
    printf '[PASS] %s expected=%s actual=%s\n' "$name" "$expected" "$actual"
}
check 0 baseline bash "$fixture/scripts/dev/setup.sh" --diagnostic --install
check 0 idempotent bash "$fixture/scripts/dev/setup.sh" --install
check 1 reject-punctuation env NAJA_TEST_COMPILER=1x97x1 bash "$fixture/scripts/dev/setup.sh"
check 1 reject-wrong-cargo env NAJA_TEST_CARGO=1.97.2 bash "$fixture/scripts/dev/setup.sh"
check 1 missing-component-dry-run env NAJA_TEST_MISSING_COMPONENT=1 bash "$fixture/scripts/dev/setup.sh" --install --dry-run
grep -q '^\[PLAN\] rustup component add rustfmt clippy --toolchain ' "$fixture/missing-component-dry-run.log" || { printf '%s\n' 'Existing toolchain component repair used the wrong command.' >&2; exit 1; }
: > "$NAJA_TEST_CALLS"
check 1 reject-lookalike-toolchain env NAJA_TEST_TOOLCHAIN=1x97x1 bash "$fixture/scripts/dev/setup.sh"
if grep -q '^run ' "$NAJA_TEST_CALLS"; then printf '%s\n' 'Missing exact toolchain invoked a compiler proxy.' >&2; exit 1; fi
check 2 reject-custom-origin env NAJA_TEST_MISSING_COMPONENT=1 RUSTUP_DIST_SERVER=https://example.invalid bash "$fixture/scripts/dev/setup.sh" --install
check 2 reject-checksum env NAJA_TEST_MISSING_COMPONENT=1 bash "$fixture/scripts/dev/setup.sh" --install
sed 's/"rust_version": "1.97.1"/"rust_version": "latest"/' "$fixture/original.json" > "$fixture/bootstrap/toolchains.json"
check 2 invalid-manifest-pin bash "$fixture/scripts/dev/setup.sh"
cp "$fixture/original.json" "$fixture/bootstrap/toolchains.json"
check 2 invalid-scope bash "$fixture/scripts/dev/setup.sh" --scope invalid
if grep -Eq '^(toolchain install|component add)' "$NAJA_TEST_CALLS"; then printf '%s\n' 'Unexpected installation attempted.' >&2; exit 1; fi
printf '%s\n' 'All 10 offline setup-logic checks passed. Fixtures do not verify actual Linux/macOS toolchain availability.'
