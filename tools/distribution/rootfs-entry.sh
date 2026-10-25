#!/bin/sh
# Executed only in a fresh unprivileged user/mount/PID/network namespace.
set -eu
root=$1
shift
mount --bind /dev/null "$root/dev/null"
exec /usr/sbin/chroot "$root" /usr/bin/env -i PATH=/no-tools TMPDIR=/tmp LC_ALL=C "$@"
