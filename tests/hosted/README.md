# Hosted native IR tests

Run `node scripts/test-hosted.mjs` from this checkout. It builds the development
IR adapter, emits native ELF files and executes them on Linux x86-64 (Ubuntu WSL
when hosted on Windows). The adapter's line/RPN format is test infrastructure,
not NAJA source or an alternate production grammar.

`control.ir` is independently readable input for groups, branches and loops.
Other cases are generated from fixed boundaries and a deterministic seeded input
sequence. Node BigInt supplies expected arithmetic/comparison results; emitted
programs perform their own arithmetic natively. Literal and carry-threshold
mutants must produce a detected difference from those expectations. The harness
also covers immutability, resource/I/O errors, invalid IR and deterministic bytes.

Each artifact has an external five-second timeout. Artifact hashes and exact
outputs/exits are checked; temporary source/binaries remain under ignored
`target/hosted-native-*`. No Python, foreign assembler, linker or interpreter is
used to execute these generated programs. Rust and Node remain seed/test tools;
this suite does not establish self-hosting, full frontend support or FC1.
