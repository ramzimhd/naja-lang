# Publication review dispositions — October 25, 2026

The bounded pattern scanner's exact-index report is retained in
`PUBLICATION_REVIEW_2026-10-25_V13.json`. Its result remains `failed`: one
`private-user-path` match in `tests/continuity/public.test.mjs`, line 119.

Manual inspection confirms the matched value is an intentionally synthetic
Windows profile path in a negative validation fixture. The synthetic person
name and private-key suffix are test data, not a founder path, credential,
private file or authentication value. The test requires the public observation
validator to reject that value. It executes only against a synthetic observation;
it never opens the represented file. The full test source and current staged
diff were reviewed. The fixture, scanner rule and failed result are preserved.
No tolerance, test, privacy rule or requirement was disabled to obtain a pass.

The reviewed publication adds independent compiler/runtime/frontend/CLI source,
specified Unicode seed dependencies and license copies, additive continuation
contracts, recovery helpers and fixtures, source-pinned review reports, fourteen
retained command records and truthful progress metadata. The current staged
changes after source4f93a39 are evidence, review and progress records; they do
not relabel that source's checks as passing a newer source. No L/C/FC1 or HATCH
gate is promoted by this publication.

Raw logs retain their captured bytes and hashes. The authored-whitespace check
explicitly excludes raw logs and exact copied license bytes. Public records
contain the owner's authorized public identity and repository URL, sanitized
relative evidence paths and subscription-window percentages. No private token,
reservation nonce, account identifier, credit balance, Git recovery payload,
ignored local helper, attachment or user-profile inventory is staged.

The scan reviewed the tree named in its JSON before that report and this
disposition were added. Those two authored files were separately read and
reviewed. A bounded scan and manual review cannot prove absence of every secret
or personal fact. The single retained finding is accepted as synthetic fixture
content within the existing public-repository authorization; it is not presented
as a clean automated scan or a recovered historical pre-first-push transcript.
