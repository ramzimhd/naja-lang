# Frozen native file and UTF-8 test contract

Committed before the first native file/conversion harness execution. Reference
execution is Linux x86-64, through explicit local WSL from the Windows seed.
Artifact timeout is five seconds; no Python or host interpreter supplies results.

- ReadFile(Text) returns Bytes. EncodeUtf8(Text) returns Bytes; DecodeUtf8(Bytes)
  strictly returns Text. Views preserve bytes, Unicode and NUL without normalization.
- E::WriteFile{path,data} evaluates PATH then DATA once and returns None, matching
  ordinary source call argument order. S::WriteFile evaluates DATA then PATH once.
  Both require Text path and Bytes data and share only the completed-operand helper.
- MAX_FILE_BYTES is16MiB. MAX_PATH_BYTES is4095UTF8 bytes, plus one terminator.
  Paths reject embedded NUL. Existing64MiB arena and all other budgets stay fixed.
- Read opens with O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC, then fstat requires a regular
  handle. Leaf symlinks/devices/FIFOs/directories fail without stream reads.
- Initial fstat size bounds allocation. Shrinking EOF returns actual bytes;
  observing any byte beyond initial size fails103, even below16MiB. No snapshot
  or same-size concurrent-change detection is claimed. Read capacity includes
  one extra probe byte and never exceeds the fixed file limit plus that probe.
- Write uses O_WRONLY|O_CREAT|O_EXCL|O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC, mode0600
  subject to umask. Existing files remain unchanged. Partial owned output remains
  on failure. No unlink, overwrite, recursive cleanup or fsync/durability claim.
- Transfer chunks are at most65536 bytes. A file operation admits65536 total
  openat/fstat/read/write syscall attempts, including EINTR, and eight EINTR
  retries across the operation. Close is attempted once, never retried, and is
  excluded from this counter so cleanup remains possible when budget is exhausted.
- Normal EOF/complete-write paths close before returning. Active handles close
  before process diagnostics where feasible; allocator capacity is preflighted
  before allocation while a handle is owned. Close errors fail108.
- IO/path failures use NJA208/108; invalid UTF8 conversion uses NJA209/109;
  file/path/arena/growth limits use accurate NJA203/103 diagnostics. Wrong kinds105.
- All descriptor/data spans are checked before payload access. These checks do
  not establish arbitrary pointer provenance or make modified executables safe.
- Private scratch fixtures cover Unicode/spaces/inert metacharacter paths, EOF,
  all bytes/NUL,16MiB-1/exact/+1, exclusive writes, symlink/FIFO/device rejection,
  permissions, partial errors/retention, close limits, evaluation effects/order,
  strict invalid UTF8 boundaries, changed source data and IO/limit mutants.
- Ordinary OS rights and parent-directory links apply. No filesystem confinement,
  IO deadline, sandbox, full exception/filesystem, clean-host or HATCH claim.

Implementation defects may be corrected; expectations, caps and timeouts must
not be loosened after failure. Retain failure logs and state corrections honestly.
