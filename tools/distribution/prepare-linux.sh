#!/bin/sh
# Developer-only controlled preparation. No user distribution invokes this file.
set -eu
umask 077
[ "$#" -eq 1 ] || exit 2
out=$1
test -d "$out"
mkdir "$out/linux-build"
work=$(mktemp -d /tmp/naja-distribution.XXXXXXXX)
printf '%s\n' "$work" > "$out/linux-location.txt"
mkdir "$work/source" "$work/cargo" "$work/rustup"
tar -xf "$out/source.tar" -C "$work/source"
export CARGO_HOME="$work/cargo" RUSTUP_HOME="$work/rustup"
export PATH="$CARGO_HOME/bin:/usr/bin:/bin"
curl --proto '=https' --tlsv1.2 -fSsL --max-time 60 --max-filesize 2097152 https://static.rust-lang.org/dist/channel-rust-1.97.1.toml -o "$work/rust-manifest.toml"
printf '%s  %s\n' 03569b1886ceb5c05276b50c8431ab111de944cd6140fe1fa7d821dd8e0f29cf "$work/rust-manifest.toml" | sha256sum -c -
curl --proto '=https' --tlsv1.2 -fSsL --max-time 60 --max-filesize 33554432 https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init -o "$work/rustup-init"
curl --proto '=https' --tlsv1.2 -fSsL --max-time 60 --max-filesize 1024 https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init.sha256 -o "$work/rustup-init.sha256"
installer_hash=$(cut -d ' ' -f 1 "$work/rustup-init.sha256")
printf '%s  %s\n' "$installer_hash" "$work/rustup-init" | sha256sum -c -
chmod 700 "$work/rustup-init"
timeout -k 5 600 "$work/rustup-init" -y --no-modify-path --profile minimal --default-toolchain 1.97.1
"$CARGO_HOME/bin/rustup" --version
"$CARGO_HOME/bin/rustc" +1.97.1 -Vv
"$CARGO_HOME/bin/cargo" +1.97.1 -Vv
cd "$work/source"
timeout -k 5 120 "$CARGO_HOME/bin/cargo" +1.97.1 fetch --locked
for entry in 'tinyvec-1.12.0 bb4ebadaa0af04fab11ae01eb5f9fdb5f9c5b875506e210e71c07873528baa7f' 'tinyvec_macros-0.1.1 1f3ccbac311fea05f86f61904b462b55fb3df8837a366dfc601a0161d0532f20' 'unicode-ident-1.0.24 e6e4313cd5fcd3dad5cafa179702e2b244f760991f45397d14d4ebf38247da75' 'unicode-normalization-0.1.25 5fd4f6878c9cb28d874b009da9e8d183b5abc80117c40bbd187a1fde336be6e8'; do
  name=${entry%% *}; expected=${entry#* }
  set -- "$CARGO_HOME"/registry/cache/*/"$name.crate"
  [ "$#" -eq 1 ] && test -f "$1"
  printf '%s  %s\n' "$expected" "$1" | sha256sum -c -
done
# No registry access during this actual compile; source archive is pinned.
export RUSTFLAGS="--remap-path-prefix=$work/source=<source>"
timeout -k 5 180 "$CARGO_HOME/bin/cargo" +1.97.1 build --workspace --release --locked --offline --target-dir "$work/build"
cp "$work/build/release/naja" "$out/linux-build/naja"
readelf -dW "$work/build/release/naja" > "$out/linux-build/dynamic.txt"
readelf -lW "$work/build/release/naja" > "$out/linux-build/program.txt"
readelf --version-info -W "$work/build/release/naja" > "$out/linux-build/versions.txt"
ldd "$work/build/release/naja" > "$out/linux-build/ldd.txt"
mkdir "$out/linux-build/rust-licenses"
for file in COPYRIGHT LICENSE-APACHE LICENSE-MIT; do
  curl --proto '=https' --tlsv1.2 -fSsL --max-time 60 --max-filesize 2097152 "https://raw.githubusercontent.com/rust-lang/rust/1.97.1/$file" -o "$out/linux-build/rust-licenses/$file"
done
sha256sum "$work/rust-manifest.toml" "$work/rustup-init" "$out/linux-build/naja" "$out/linux-build/rust-licenses/"*
du -sk "$work"
printf '%s\n' 'PREPARED_PINNED_LINUX_SEED'
