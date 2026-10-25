# Evidence recorder checks

Run `node --test tests/evidence/*.test.mjs` on a host with PowerShell7, Git,
Node and the seed tools available. CI runs these checks on Windows. They create
disposable synthetic Git repositories, copy the recorder itself, and never use
production authentication, source mutations or verification state.

The five cases cover stable success and retained output hashes, name reuse,
tracked source mutation, a changed committed HEAD, child exit7, and hidden index
entries. A successful child that changes source produces a failed record with
its actual exit0 and the original source identity; the recorder wrapper exits1.
The tests distinguish child exit status from wrapper refusal.

The guard checks source identity and Git-visible cleanliness at the boundaries.
It is not a filesystem monitor, security boundary or proof against changes that
were completely restored during execution. Evidence also needs independent
coverage review; an internally consistent log does not establish full requirement
acceptance. Captured log bytes are retained; newly written JSON uses UTF-8/LF.
