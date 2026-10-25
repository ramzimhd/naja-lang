#!/bin/sh
# Experimental unsigned seed installer. No downloads, evaluation or cleanup.
set -eu
set -C
if [ "$#" -ne 1 ]; then printf '%s\n' 'Usage: /bin/sh install.sh NEW_ABSOLUTE_PREFIX' >&2; exit 2; fi
prefix=$1
case "$prefix" in /*) ;; *) printf '%s\n' 'Installation prefix must be absolute.' >&2; exit 2;; esac
case "$prefix" in *'/../'*|*'/..'|*'/./'*|*'/.'|*'//'*) printf '%s\n' 'Installation prefix has unsupported path components.' >&2; exit 2;; esac
case "$prefix" in *'
'*) printf '%s\n' 'Control characters are not allowed in the prefix.' >&2; exit 2;; esac
if [ "${#prefix}" -gt 4096 ] || [ -e "$prefix" ] || [ -L "$prefix" ]; then printf '%s\n' 'Installation requires a new bounded prefix.' >&2; exit 2; fi
if printf '%s' "$prefix" | LC_ALL=C grep '[[:cntrl:]]' >/dev/null; then printf '%s\n' 'Control characters are not allowed in the prefix.' >&2; exit 2; fi
parent=$(dirname -- "$prefix")
cursor=$parent
while [ "$cursor" != / ]; do
  if [ -L "$cursor" ] || [ ! -d "$cursor" ]; then printf '%s\n' 'Installation parent must exist without symbolic links.' >&2; exit 2; fi
  cursor=$(dirname -- "$cursor")
done
package=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
(cd -- "$package" && sha256sum -c SHA256SUMS) >/dev/null
mkdir -- "$prefix"
trap 'printf "%s\n" "Installation failed; owned partial prefix was preserved." >&2' 0
mkdir -- "$prefix/bin" "$prefix/licenses" "$prefix/licenses/seed" "$prefix/licenses/rust" "$prefix/provenance"
for file in bin/naja LICENSE NOTICE README.md manifest.json install.sh SHA256SUMS licenses/seed/tinyvec-APACHE.md licenses/seed/tinyvec_macros-APACHE.md licenses/seed/unicode-ident-APACHE licenses/seed/unicode-ident-UNICODE licenses/seed/unicode-normalization-APACHE licenses/rust/COPYRIGHT licenses/rust/LICENSE-APACHE licenses/rust/LICENSE-MIT provenance/Cargo.lock provenance/toolchains.json provenance/unicode.json; do
  cat -- "$package/$file" > "$prefix/$file"
done
chmod 755 -- "$prefix/bin/naja"
trap - 0
printf '%s\n' 'Installed unsigned experimental NAJA seed into the new prefix.'
