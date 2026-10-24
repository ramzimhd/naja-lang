# Productivity Benchmark Templates

Read documents 21 and 22 before filling these files. This folder contains proposed case definitions and empty evidence templates, not implementations or measurements.

`cases.json` must be completed and preregistered before benchmark-specific optimization. `results.template.json` deliberately uses null/not_run for every measurement. Copy it to an implementation report only when recording actual results. Never replace missing data with zero, an estimate or a fabricated pass.

Keep all Rust/C++ comparison tooling outside the NAJA user/autonomy dependency closure. Preserve standard-library engineering costs separately. Required cases cover a bounded microkernel, applications and native data pipelines; full OS/distributed-data products are not implied.
