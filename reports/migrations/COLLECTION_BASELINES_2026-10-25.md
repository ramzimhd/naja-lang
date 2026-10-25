# Collection baseline migration

The original tuple harness passed 137 cases at `b0456b6`. Its unchanged older
index baseline actually failed one obsolete compile-rejection expectation,
retaining 79 passed, one failed and three `not_run` cases in
`tests/tuples-source/INDEX_BASELINE_FAILURE_2026-10-25.json`. That failure remains
failed; historical results and frozen source hashes are unchanged.

After list/source mutation integration, focused probes at
`a956839e43c78dba6404060c03223a22a7de59cf` executed the six affected original
source forms before migrating the old harnesses. The two JSON records in this
directory retain source/harness hashes, actual check/build/run exits, stream
hashes and built ELF identities. They are focused observations, not claims of
passing the complete old suites. Build and run compile the same source
separately; identity between their temporary artifacts is not asserted.

Tuple/List index operands, list display, and Text/tuple indexed assignment now
check and build successfully, then correctly reach the runtime type diagnostic
NJA205/exit105. The list literal case correctly executes and prints `1`. The
migration makes those runtime expectations explicit; it also keeps an actual
unsupported list-comprehension rejection. The tuple display guard was already
migrated when tuple syntax was added. Runtime type rejection remains incomplete
semantic work, not acceptance of tuple/list display or comparisons.

No source requirement, resource budget, timeout or tolerance was relaxed. The
full current harnesses must execute again at their new source identity before
new passing results are claimed. The original tuple preparation/run narratives
remain historical; current script behavior follows the additive migration.

The first combined collection run at `aba7307` also exposed an unprefixed list
rejection in the older explicit-i64 native harness. Its actual exit1 remains in
`reports/checks/v13-collections-native.json` and the paired sanitized raw log;
the other 25 combined commands passed at that source. The original fixture
`x = [1, 2, 3]` now correctly compiles in the ordinary value domain. The current
fixed-domain rejection instead explicitly imports i64 and constructs a list of
i64 values for an i64 binding. That preserves the domain-separation check;
ordinary lists execute in the separately frozen source harness. No product
validation or budget was relaxed, and the failed run is not relabeled.
