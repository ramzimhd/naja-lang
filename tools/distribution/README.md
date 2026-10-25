# Experimental Linux seed distribution preparation

This developer tooling packages a pinned native Rust-built compiler; it does
not implement `naja package`, self-hosting, a signed release or full FC1/HATCH.
It belongs to T12/FC1-01 groundwork. T22 is a different build-closure task.

This historical experiment requires compiler inputs identical to the pinned
source below. The current class compiler has newer inputs, so the verifier
deliberately refuses to package it under the old source identity. Reproduce the
experiment from a separate checkout at `ef3a97428c1cdf3525be6b9a0d7887bb95a032ef` (which contains these tools and
the original compiler inputs), on the observed Windows/Ubuntu WSL host:

```text
node tools/distribution/verify.mjs
```

The finite harness first executes synthetic packager tests, exports exact source
`a51c2808bae4b57596f7f957ce53530004a504f8`, prepares official Linux Rust 1.97.1
in a new private prefix, stages four checksum-pinned Cargo dependencies, builds
offline, inspects actual ELF dependencies and packages a local unsigned archive.
It then checks exclusive-prefix installation and a disposable minimal copied
userland with only declared OS tools/libraries. See the frozen
`tests/distribution/PREREGISTRATION.md` for exact budgets and boundaries.

No system installation, profile edit, deletion, service, paid/cloud dependency,
publication or mandatory Python step occurs. The packaged installer uses only
ordinary OS shell utilities; installed compiler/program execution needs neither
Node nor the Rust seed tools. Raw outputs and artifacts remain ignored under
`tools/distribution/artifacts/`; Linux preparation retains its owned `/tmp`
directory. Inspect failures before retrying. Each retry creates new output.
Do not interpret an empty PATH as a clean host: only the separately inventoried
copied-userland checks can support that narrower scoped observation.

After a retained preparation passes but a later stage fails, the explicit
`--prepared ABSOLUTE_PRIOR_OUTPUT` option audits its source/contract, successful
preparation record, raw log hashes and compiler/license/archive bytes, then
copies only fixed inputs into a new exclusive output. It does not rerun stored
commands or authenticate log honesty. Namespace tests always use a new private
directory. Old logs and partial work remain unchanged.

`package.mjs` can separately stage validated explicit inputs into a new directory:

```text
node tools/distribution/package.mjs --binary ABSOLUTE_ELF --inspection ABSOLUTE_JSON --rust-licenses ABSOLUTE_DIRECTORY --output NEW_ABSOLUTE_DIRECTORY
```

Inspection JSON has the raw `readelf -dW`, `readelf -lW` and
`readelf --version-info -W` output strings in `dynamic`, `program`, `versions`.
The packager validates their bounded declared dependency shape. These supplied
reports are not cryptographically bound to a binary by the packager alone;
the execution harness obtains them from the actual just-built compiler.
Header validation and hashes are integrity checks, not publisher authentication.
