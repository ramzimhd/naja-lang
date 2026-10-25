#!/bin/sh
set -eu
umask 077
[ "$#" -eq 2 ] || exit 2
out=$1
scripts=$2
work=$(mktemp -d /tmp/naja-distribution.XXXXXXXX)
printf '%s\n' "$work" > "$out/test-location.txt"
root=$work/rootfs
mkdir "$root" "$work/unpacked"
tar -xzf "$out/naja-linux-x86_64-unsigned.tar.gz" -C "$work/unpacked"
mkdir "$work/prefix-parent"
/bin/sh "$work/unpacked/install.sh" "$work/prefix-parent/naja"
/usr/bin/env -i PATH=/no-tools "$work/prefix-parent/naja/bin/naja" --version
mkdir "$work/prefix-parent/existing"
printf 'preserve-me\n' > "$work/prefix-parent/existing/sentinel"
if /bin/sh "$work/unpacked/install.sh" "$work/prefix-parent/existing"; then printf '%s\n' 'Existing-prefix mutation unexpectedly succeeded.' >&2; exit 1; fi
test "$(cat "$work/prefix-parent/existing/sentinel")" = preserve-me
mkdir "$root/package" "$root/opt" "$root/workspace" "$root/tmp" "$root/dev"
: > "$root/dev/null"
cp -R "$work/unpacked/." "$root/package/"
cp "$out/independent.naja" "$root/workspace/input é.naja"
cp "$out/changed.naja" "$root/workspace/changed.naja"
cp "$out/unsupported.naja" "$root/workspace/unsupported.naja"
cp "$out/failure.naja" "$root/workspace/test_failure.naja"
copy_native() {
  cp -L --parents "$1" "$root"
  ldd "$1" | awk '$3 ~ /^\// {print $3} $1 ~ /^\// {print $1}' | while IFS= read -r library; do cp -L --parents "$library" "$root"; done
}
for tool in /bin/sh /usr/bin/cat /usr/bin/chmod /usr/bin/dirname /usr/bin/grep /usr/bin/mkdir /usr/bin/sha256sum /usr/bin/env; do copy_native "$tool"; done
ldd "$work/unpacked/bin/naja" | awk '$3 ~ /^\// {print $3} $1 ~ /^\// {print $1}' | while IFS= read -r library; do cp -L --parents "$library" "$root"; done
enter() { unshare --user --map-root-user --mount --pid --fork --net -- /bin/sh "$scripts/rootfs-entry.sh" "$root" "$@"; }
# Installer has only declared OS utilities; compiler invocations get /no-tools.
enter /bin/sh -c 'PATH=/usr/bin:/bin; export PATH; exec /bin/sh /package/install.sh /opt/naja'
enter /opt/naja/bin/naja --version
enter /opt/naja/bin/naja --help
enter /opt/naja/bin/naja doctor --json
enter /opt/naja/bin/naja check '/workspace/input é.naja' --json
enter /opt/naja/bin/naja build '/workspace/input é.naja' --target x86_64-unknown-linux-gnu --output /workspace/app
readelf -lW "$root/workspace/app" > "$out/app-program.txt"
readelf -dW "$root/workspace/app" > "$out/app-dynamic.txt"
test "$(enter /workspace/app)" = 43
printf '%s\n' 'PASS independently-supplied-native-output=43'
before=$(sha256sum "$root/workspace/app" | cut -d ' ' -f 1)
cp "$root/workspace/changed.naja" "$root/workspace/input é.naja"
enter /opt/naja/bin/naja build '/workspace/input é.naja' --target x86_64-unknown-linux-gnu --output /workspace/changed-app
test "$(enter /workspace/changed-app)" = 52
after=$(sha256sum "$root/workspace/changed-app" | cut -d ' ' -f 1)
test "$before" != "$after"
printf '%s\n' 'PASS changed-source-native-output=52; artifact differs'
test "$(enter /opt/naja/bin/naja run '/workspace/input é.naja' --timeout-ms 2000)" = 52
printf '%s\n' 'PASS direct-run-empty-PATH'
enter /opt/naja/bin/naja init '/workspace/generated é'
enter /opt/naja/bin/naja test '/workspace/generated é' --json --timeout-ms 2000 > "$out/generated-tests.json"
cat "$out/generated-tests.json"
if enter /opt/naja/bin/naja check /workspace/unsupported.naja --json > "$out/unsupported-check.json"; then printf '%s\n' 'Unsupported class mutation unexpectedly passed.' >&2; exit 1; else test "$?" -eq 1; fi
cat "$out/unsupported-check.json"
if enter /opt/naja/bin/naja test /workspace/test_failure.naja --json --timeout-ms 2000 > "$out/failure-tests.json"; then printf '%s\n' 'Injected assertion mutation unexpectedly passed.' >&2; exit 1; else test "$?" -eq 1; fi
cat "$out/failure-tests.json"
test "$(sha256sum "$root/opt/naja/bin/naja" | cut -d ' ' -f 1)" = "$(sha256sum "$work/unpacked/bin/naja" | cut -d ' ' -f 1)"
printf 'corruption\n' >> "$root/package/bin/naja"
if enter /bin/sh -c 'PATH=/usr/bin:/bin; export PATH; exec /bin/sh /package/install.sh /opt/corrupt'; then printf '%s\n' 'Corrupt package mutation unexpectedly installed.' >&2; exit 1; fi
test ! -e "$root/opt/corrupt"
(cd "$root" && find . -type f -print | LC_ALL=C sort) > "$out/rootfs-files.txt"
(cd "$root" && find . -type f -exec sha256sum '{}' ';' | LC_ALL=C sort -k 2) > "$out/rootfs-sha256.txt"
test "$(wc -l < "$out/rootfs-files.txt")" -le 128
test "$(find "$root" -type l | wc -l)" -eq 0
sha256sum "$root/workspace/app" "$root/workspace/changed-app" "$root/opt/naja/bin/naja"
printf '%s\n' 'PASS existing-prefix preserved; corrupted-package refused; rootfs inventory retained'
printf '%s\n' 'ROOTFS_CHECKS_PASSED'
