# Retained preparation correction

The first execution of frozen preparation `bfe181c` passed all six packager unit
tests and built the pinned Linux seed offline. It then failed before packaging:
the actual ELF lists the already-declared GNU loader `ld-linux-x86-64.so.2` as
both INTERP and NEEDED. The validator recognized that exact loader only in
INTERP. The retained failed run is `artifacts/verify-Uynctd` under the distribution
tools directory. Its source/build/log identities are retained for the report.

The correction recognizes the same already-declared loader in NEEDED and adds
a regression test that still rejects an unknown loader. File/size/library-count,
time and output limits are unchanged. No compiler or feature requirement changed.

Before repeating execution, explicit `--prepared ABSOLUTE_PRIOR_OUTPUT` reuse was
added to avoid another toolchain download/build. It audits the original source,
contract, successful preparation step, retained raw logs, source archive,
compiler and license hashes; tests inject changed source, failed preparation,
escaped paths, changed binary and changed raw logs. It copies fixed bytes into a
new exclusive output, and actual readelf inspection is repeated on those bytes.
Userland tests always allocate a new private directory. Old failures and owned
partial work remain. Static record integrity does not authenticate log honesty.
