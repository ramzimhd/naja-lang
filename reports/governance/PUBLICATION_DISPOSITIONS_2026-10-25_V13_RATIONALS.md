# Rational integration publication disposition

The retained scanner result is **failed**, exit 1. Its sole finding is the
unchanged synthetic private-user-path fixture in `tests/continuity/public.test.mjs`.
Comparison against published `0d89474` confirmed identical bytes. This is a
deliberate negative test, manually accepted for publication. No rule, matcher,
allowlist, tolerance or expected result was changed.

Review covered staged tree `2eefa660512ec002c77cfb22450a4069c840a124` and its
1,066 tracked paths, including committed source/evidence changes since the last
publication. The generated review and this disposition were inspected separately
after that tree. All 19 new encoded stream captures were decoded, round-trip/
length/SHA-256 checked and scanned for credentials, private profiles/contacts and
private keys: 105,137 decoded bytes, no such finding. The two earlier typed
captures remain unchanged from their separately retained review.

The two-byte Rational input fixture is synthetic independent test data. Raw
compiler binaries, generated ELF files, private runtime captures, local settings
and credentials remain ignored. Source failures and historical pinned records
are retained accurately. Already integrated source branches were retained in
merge ancestry after compiler-byte equality checks; the ancestry-only merges
were checked to preserve the primary tree exactly. This keeps the original
typed/Rational proof commits available with the public source history.

This is manual disposition of a bounded scanner finding, not a claim that the
scanner passed, an automatic approval rejection or full security/release audit.
All founder acceptance gates remain open. The authorized public repository and
owner-selected Apache-2.0 license remain the publication authority.
