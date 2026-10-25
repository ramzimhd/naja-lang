mod execution;

use execution::{Outcome, Runner};
use std::{
    env,
    ffi::OsString,
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    time::Duration,
};

const HELP: &str = "NAJA HATCH 0.0.1 experimental Rust seed\n\nUsage:\n  naja --version\n  naja lex SOURCE\n  naja check SOURCE\n  naja build SOURCE --target x86_64-unknown-linux-gnu --output NEW_FILE\n  naja run SOURCE [--runner wsl] [--timeout-ms N] [-- ARGS...]\n  naja test DIRECTORY|SOURCE [--runner wsl] [--filter TEXT] [--json] [--timeout-ms N]\n\nUse naja COMMAND --help for command options and limits.\nThis seed supports native decimal hosted integers with +, -, *, comparisons, assignment, if/else, while and print.\nThe hosted arena is limited to 64 MiB; exhaustion reports NJA203 and exits 103.\nExplicit from naja.core import i64 selects the separate checked-i64 slice; mixed domains remain unsupported.\n.naja selects edition 2026.1; .py keeps its separate compatibility dialect.\nFull grammar, other hosted values, aliases and self-hosting remain unimplemented.\n";
const RUN_HELP: &str = "Usage: naja run SOURCE [--runner wsl] [--timeout-ms N] [-- ARGS...]\n\nCompile to a new temporary Linux x86-64 ELF and execute with literal argument boundaries.\nLinux x86-64 runs directly. Windows requires explicit --runner wsl and a Linux x86-64 WSL distribution with /usr/bin/{uname,wslpath,chmod,timeout}.\nThe default program deadline is 5000 ms; --timeout-ms accepts 1..60000. Temporary ELF size is limited to 16 MiB.\nChild stdin/stdout/stderr are inherited. Numeric child exits are preserved; a directly observed signal returns 128+signal and is reported on stderr.\nWSL exposes translated statuses, not an exact child signal. Its target-side timeout returns 124, which cannot be distinguished from a child exit 124; a forced timeout may return 137.\nTemporary files are removed after execution. Execution uses ordinary OS rights and is not a sandbox.\n";
const TEST_HELP: &str = "Usage: naja test DIRECTORY|SOURCE [--runner wsl] [--filter TEXT] [--json] [--timeout-ms N]\n\nA program-file test passes when compilation succeeds and native execution exits zero. This is not a test-function framework.\nDirectory discovery recursively selects test_*.naja and test_*.py; explicit SOURCE accepts either extension. Names sort by Unicode UTF-8 relative path; --filter is a case-sensitive substring.\nSymlinks are skipped (an explicit symlink is rejected); limits are 256 files, 4096 entries and depth 16, applied before filtering. No selected tests is an error.\nEach program has null stdin, a default 5000 ms deadline (1..60000 via --timeout-ms), and at most 65536 retained bytes per output stream. Exceeding the output limit fails the case.\n--json emits one schema-version-1 report on stdout, including compile/runtime failures, exact observed exits/signals, UTF-8 display validity flags and lossless stdout_hex/stderr_hex output bytes. Operational/argument errors use stderr.\nTests run sequentially under ordinary OS rights, not in a sandbox. Windows requires --runner wsl; WSL signal information is unavailable and status 124 means timeout-or-child-exit-124.\n";

fn main() {
    let code = match run() {
        Ok(code) => code,
        Err(message) => {
            eprintln!("{message}");
            1
        }
    };
    // All execution and temporary-artifact guards have returned before exiting.
    std::process::exit(code);
}

fn command_help(operation: &str) -> String {
    match operation {
        "run" => RUN_HELP.into(), "test" => TEST_HELP.into(),
        "build" => "Usage: naja build SOURCE --target x86_64-unknown-linux-gnu --output NEW_FILE\n\nCompile the experimental integer subset to Linux x86-64 ELF without execution. Refuses to overwrite any existing output. Source is UTF-8 .py or .naja, at most 1 MiB.\n".into(),
        "check" => "Usage: naja check SOURCE\n\nCheck the experimental integer subset without executing user code or creating a native artifact. Source is UTF-8 .py or .naja, at most 1 MiB.\n".into(),
        "lex" => "Usage: naja lex SOURCE\n\nPrint original token spans for UTF-8 .py or .naja source, at most 1 MiB. Does not execute user code.\n".into(),
        _ => HELP.into(),
    }
}

fn run() -> Result<i32, String> {
    let arguments: Vec<_> = env::args_os().skip(1).collect();
    if arguments.len() == 1 && (arguments[0] == "--help" || arguments[0] == "-h") {
        print!("{HELP}");
        return Ok(0);
    }
    if arguments.len() == 1 && arguments[0] == "--version" {
        println!(
            "naja 0.0.1 HATCH experimental Rust seed; native target Linux x86-64; no self-hosting claim"
        );
        return Ok(0);
    }
    let operation = arguments
        .first()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("NJA001: a command is required\n{HELP}"))?;
    if !matches!(operation, "lex" | "check" | "build" | "run" | "test") {
        return Err(format!("NJA001: unknown command '{operation}'\n{HELP}"));
    }
    if arguments.len() == 2 && (arguments[1] == "--help" || arguments[1] == "-h") {
        print!("{}", command_help(operation));
        return Ok(0);
    }
    if arguments.len() < 2
        || arguments[1]
            .to_str()
            .is_some_and(|value| value.starts_with('-'))
    {
        return Err(format!(
            "NJA001: {operation} requires its source/path first\n{}",
            command_help(operation)
        ));
    }
    let path = Path::new(&arguments[1]);
    if operation == "run" || operation == "test" {
        let options = parse_execution_options(operation, &arguments[2..])?;
        options.runner.validate()?;
        if operation == "test" {
            return test_programs(path, &options);
        }
        let (source, dialect) = read_source(path)?;
        let binary = naja_seed::compile_with_dialect(&source, dialect)
            .map_err(|errors| diagnostics(path, &source, &errors))?;
        options.runner.prepare()?;
        let outcome = execution::execute(
            &binary,
            &options.arguments,
            options.runner,
            options.timeout,
            false,
        )?;
        if let Some(signal) = outcome.signal {
            eprintln!(
                "NJA013: native child terminated by signal {signal}; returning {}",
                outcome.code()
            );
        }
        if outcome.timed_out {
            eprintln!("NJA013: native process exceeded the host deadline; returning 124");
        }
        if options.runner == Runner::Wsl && outcome.exit_code == Some(124) {
            eprintln!("NJA013: WSL returned 124 (target timeout or child exit 124)");
        }
        return Ok(outcome.code());
    }
    let output = if operation == "build" {
        Some(parse_build_options(&arguments[2..])?)
    } else {
        if arguments.len() != 2 {
            return Err("NJA001: unexpected arguments".into());
        }
        None
    };
    let (source, dialect) = read_source(path)?;
    if operation == "lex" {
        let lexed = naja_frontend::lex_with_dialect(&source, dialect);
        if !lexed.diagnostics.is_empty() {
            return Err(diagnostics(path, &source, &lexed.diagnostics));
        }
        for token in &lexed.tokens {
            println!(
                "{}..{} {:?} {:?}",
                token.span.start,
                token.span.end,
                token.kind,
                lexed.text(token)
            );
        }
        return Ok(0);
    }
    if operation == "check" {
        naja_seed::check_with_dialect(&source, dialect)
            .map_err(|errors| diagnostics(path, &source, &errors))?;
        println!("Checked experimental integer subset: {}", path.display());
        return Ok(0);
    }
    let binary = naja_seed::compile_with_dialect(&source, dialect)
        .map_err(|errors| diagnostics(path, &source, &errors))?;
    let output = output.unwrap();
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o700);
    }
    let mut file = options.open(&output).map_err(|error| {
        format!(
            "NJA006: cannot create new output {}: {error}",
            output.display()
        )
    })?;
    if let Err(error) = file.write_all(&binary) {
        drop(file);
        let _ = fs::remove_file(&output);
        return Err(format!("NJA006: cannot write output: {error}"));
    }
    println!(
        "Built Linux x86-64 ELF: {} ({} bytes)",
        output.display(),
        binary.len()
    );
    Ok(0)
}

fn parse_build_options(arguments: &[OsString]) -> Result<PathBuf, String> {
    let mut target = false;
    let mut output = None;
    let mut index = 0;
    while index < arguments.len() {
        let value = arguments
            .get(index + 1)
            .ok_or("NJA001: missing build option value")?;
        if arguments[index] == "--target" && !target {
            if value != "x86_64-unknown-linux-gnu" {
                return Err("NJA003: the native spike emits Linux x86-64 ELF only".into());
            }
            target = true;
        } else if arguments[index] == "--output" && output.is_none() {
            if value.to_str().is_some_and(|value| value.starts_with('-')) {
                return Err("NJA001: invalid output option value".into());
            }
            output = Some(PathBuf::from(value));
        } else {
            return Err("NJA001: unknown or duplicate build option".into());
        }
        index += 2;
    }
    if !target {
        return Err(
            "NJA001: build requires --target x86_64-unknown-linux-gnu and --output NEW_FILE".into(),
        );
    }
    output.ok_or_else(|| {
        "NJA001: build requires --target x86_64-unknown-linux-gnu and --output NEW_FILE".into()
    })
}

pub(crate) fn source_dialect(path: &Path) -> Result<naja_frontend::Dialect, String> {
    match path.extension().and_then(|value| value.to_str()) {
        Some("naja") => Ok(naja_frontend::Dialect::Naja2026),
        Some("py") => Ok(naja_frontend::Dialect::Python),
        _ => Err("NJA002: source extension must be .py or .naja".into()),
    }
}

fn read_source(path: &Path) -> Result<(String, naja_frontend::Dialect), String> {
    let dialect = source_dialect(path)?;
    let file = fs::File::open(path)
        .map_err(|error| format!("NJA004: cannot open {}: {error}", path.display()))?;
    let mut bytes = Vec::new();
    file.take(1_048_577)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("NJA004: cannot read source: {error}"))?;
    if bytes.len() > 1_048_576 {
        return Err("NJA100: source exceeds the experimental 1 MiB limit".into());
    }
    Ok((
        String::from_utf8(bytes).map_err(|_| "NJA005: source must be UTF-8")?,
        dialect,
    ))
}

#[derive(Debug)]
struct ExecutionOptions {
    runner: Runner,
    timeout: Duration,
    filter: Option<String>,
    json: bool,
    arguments: Vec<OsString>,
}

fn parse_execution_options(
    operation: &str,
    arguments: &[OsString],
) -> Result<ExecutionOptions, String> {
    let mut result = ExecutionOptions {
        runner: Runner::Direct,
        timeout: Duration::from_millis(5000),
        filter: None,
        json: false,
        arguments: Vec::new(),
    };
    let mut runner_set = false;
    let mut timeout_set = false;
    let mut index = 0;
    while index < arguments.len() {
        if arguments[index] == "--" && operation == "run" {
            result.arguments.extend_from_slice(&arguments[index + 1..]);
            break;
        }
        if arguments[index] == "--json" && operation == "test" && !result.json {
            result.json = true;
            index += 1;
            continue;
        }
        let option = arguments[index]
            .to_str()
            .ok_or("NJA001: option name must be UTF-8")?;
        if !matches!(option, "--runner" | "--timeout-ms" | "--filter") {
            return Err(format!(
                "NJA001: unknown, duplicate or misplaced {operation} option '{option}'"
            ));
        }
        let value = arguments
            .get(index + 1)
            .and_then(|value| value.to_str())
            .filter(|value| option == "--filter" || !value.starts_with("--"))
            .ok_or("NJA001: missing or non-Unicode option value")?;
        match option {
            "--runner" if !runner_set && value == "wsl" => {
                result.runner = Runner::Wsl;
                runner_set = true;
            }
            "--timeout-ms" if !timeout_set => {
                if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
                    return Err("NJA001: --timeout-ms requires an integer in 1..60000".into());
                }
                let millis: u64 = value
                    .parse()
                    .map_err(|_| "NJA001: --timeout-ms requires an integer in 1..60000")?;
                if !(1..=60000).contains(&millis) {
                    return Err("NJA001: --timeout-ms requires an integer in 1..60000".into());
                }
                result.timeout = Duration::from_millis(millis);
                timeout_set = true;
            }
            "--filter" if operation == "test" && result.filter.is_none() && !value.is_empty() => {
                result.filter = Some(value.into())
            }
            _ => {
                return Err(format!(
                    "NJA001: invalid or duplicate {operation} option '{option}'"
                ));
            }
        }
        index += 2;
    }
    Ok(result)
}

fn test_programs(path: &Path, options: &ExecutionOptions) -> Result<i32, String> {
    let files = execution::discover(path, options.filter.as_deref())?;
    options.runner.prepare()?;
    let mut passed = 0;
    let mut reports = Vec::new();
    for file in &files {
        let result = read_source(&file.path).and_then(|(source, dialect)| {
            naja_seed::compile_with_dialect(&source, dialect)
                .map_err(|errors| diagnostics(&file.path, &source, &errors))
        });
        let (status, outcome, diagnostic) = match result {
            Ok(binary) => {
                match execution::execute(&binary, &[], options.runner, options.timeout, true) {
                    Ok(outcome) => {
                        if outcome.passed() {
                            passed += 1;
                        }
                        (outcome.status(options.runner), Some(outcome), None)
                    }
                    Err(error) => ("runner_failed", None, Some(error)),
                }
            }
            Err(error) => ("compile_failed", None, Some(error)),
        };
        if options.json {
            reports.push(test_json(
                &file.name,
                status,
                outcome.as_ref(),
                diagnostic.as_deref(),
            ));
        } else {
            println!("{status}: {}", file.name);
            if let Some(outcome) = outcome {
                if std::str::from_utf8(&outcome.stdout_bytes).is_err()
                    || std::str::from_utf8(&outcome.stderr_bytes).is_err()
                {
                    eprintln!(
                        "NJA015: child output contains non-UTF-8 bytes; display uses replacement characters; --json preserves raw hex bytes"
                    );
                }
                if !outcome.stdout.is_empty() {
                    print!("{}", outcome.stdout);
                }
                if !outcome.stderr.is_empty() {
                    eprint!("{}", outcome.stderr);
                }
            }
            if let Some(diagnostic) = diagnostic {
                eprintln!("{diagnostic}");
            }
        }
    }
    if options.json {
        println!(
            "{{\"schema_version\":1,\"kind\":\"native_program_tests\",\"runner\":{},\"signal_observation\":{},\"selected\":{},\"passed\":{},\"failed\":{},\"tests\":[{}]}}",
            execution::json(options.runner.name()),
            execution::json(if options.runner == Runner::Direct {
                "direct"
            } else {
                "unavailable_through_wsl"
            }),
            files.len(),
            passed,
            files.len() - passed,
            reports.join(",")
        );
    } else {
        println!(
            "{} program tests: {passed} passed, {} failed",
            files.len(),
            files.len() - passed
        );
    }
    Ok(if passed == files.len() { 0 } else { 1 })
}

fn test_json(
    name: &str,
    status: &str,
    outcome: Option<&Outcome>,
    diagnostic: Option<&str>,
) -> String {
    let optional =
        |value: Option<i32>| value.map_or_else(|| "null".into(), |value| value.to_string());
    let stdout_bytes = outcome.map_or(&[][..], |value| value.stdout_bytes.as_slice());
    let stderr_bytes = outcome.map_or(&[][..], |value| value.stderr_bytes.as_slice());
    format!(
        "{{\"path\":{},\"status\":{},\"exit_code\":{},\"signal\":{},\"stdout\":{},\"stderr\":{},\"stdout_utf8_valid\":{},\"stderr_utf8_valid\":{},\"stdout_hex\":{},\"stderr_hex\":{},\"diagnostic\":{}}}",
        execution::json(name),
        execution::json(status),
        optional(outcome.and_then(|value| value.exit_code)),
        optional(outcome.and_then(|value| value.signal)),
        execution::json(outcome.map_or("", |value| value.stdout.as_str())),
        execution::json(outcome.map_or("", |value| value.stderr.as_str())),
        std::str::from_utf8(stdout_bytes).is_ok(),
        std::str::from_utf8(stderr_bytes).is_ok(),
        execution::json(&execution::hex(stdout_bytes)),
        execution::json(&execution::hex(stderr_bytes)),
        diagnostic.map_or_else(|| "null".into(), execution::json)
    )
}

fn diagnostics(path: &Path, source: &str, errors: &[naja_frontend::Diagnostic]) -> String {
    // Index the original source once and cap output for malicious invalid input.
    let mut starts = vec![0];
    let bytes = source.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'\r' {
            if bytes.get(index + 1) == Some(&b'\n') {
                index += 1;
            }
            starts.push(index + 1);
        } else if bytes[index] == b'\n' {
            starts.push(index + 1);
        }
        index += 1;
    }
    let mut output = errors
        .iter()
        .take(32)
        .map(|diagnostic| {
            let offset = diagnostic.span.start.min(source.len());
            let line = starts
                .partition_point(|start| *start <= offset)
                .saturating_sub(1);
            let column = source[starts[line]..offset].chars().count() + 1;
            format!(
                "{}:{}:{}: {}: {}",
                path.display(),
                line + 1,
                column,
                diagnostic.code,
                diagnostic.message
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    if errors.len() > 32 {
        output.push_str(&format!(
            "\nNJA007: {} additional diagnostics omitted",
            errors.len() - 32
        ));
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    fn options(operation: &str, arguments: &[&str]) -> Result<ExecutionOptions, String> {
        parse_execution_options(
            operation,
            &arguments.iter().map(OsString::from).collect::<Vec<_>>(),
        )
    }

    #[test]
    fn execution_options_are_strict_and_preserve_child_arguments() {
        let parsed = options(
            "run",
            &["--timeout-ms", "9", "--", "--runner", "$(literal)", "é", ""],
        )
        .unwrap();
        assert_eq!(parsed.timeout, Duration::from_millis(9));
        assert_eq!(
            parsed.arguments,
            ["--runner", "$(literal)", "é", ""].map(OsString::from)
        );
        for arguments in [
            vec!["--runner", "wsl", "--runner", "wsl"],
            vec!["--timeout-ms", "0"],
            vec!["--timeout-ms", "60001"],
            vec!["--timeout-ms", "+1"],
            vec!["--json"],
            vec!["--filter", "x"],
            vec!["bare"],
            vec!["--runner"],
            vec!["--runner", "unknown"],
        ] {
            assert!(options("run", &arguments).is_err(), "{arguments:?}");
        }
        for arguments in [
            vec!["--json", "--json"],
            vec!["--", "argument"],
            vec!["--filter", "x", "--filter", "y"],
            vec!["--filter", ""],
            vec!["--timeout-ms", "1", "--timeout-ms", "2"],
        ] {
            assert!(options("test", &arguments).is_err(), "{arguments:?}");
        }
        assert!(
            options("test", &["--json", "--filter", "café"])
                .unwrap()
                .json
        );
        assert_eq!(
            options("test", &["--filter", "--focused", "--json"])
                .unwrap()
                .filter
                .as_deref(),
            Some("--focused")
        );
    }

    #[test]
    fn machine_report_retains_runtime_and_compile_failures() {
        let outcome = Outcome {
            exit_code: None,
            signal: Some(9),
            timed_out: false,
            output_limit: false,
            stdout: "é\n".into(),
            stderr: "failure".into(),
            stdout_bytes: "é\n".as_bytes().to_vec(),
            stderr_bytes: b"failure".to_vec(),
        };
        let report = test_json("test_é.naja", "failed", Some(&outcome), None);
        assert!(report.contains("\"exit_code\":null,\"signal\":9"));
        assert!(report.contains("\"stdout\":\"é\\n\""));
        assert!(report.contains("\"stdout_utf8_valid\":true"));
        assert!(report.contains("\"stdout_hex\":\"c3a90a\""));
        assert_eq!(outcome.code(), 137);
        let report = test_json("source.py", "compile_failed", None, Some("NJA100: failure"));
        assert!(report.contains("\"diagnostic\":\"NJA100: failure\""));
        let invalid = Outcome {
            stdout: String::from_utf8_lossy(&[0xff, 0xc3, 0]).into_owned(),
            stdout_bytes: vec![0xff, 0xc3, 0],
            stderr: String::new(),
            stderr_bytes: vec![],
            exit_code: Some(0),
            signal: None,
            timed_out: false,
            output_limit: false,
        };
        let report = test_json("bytes.naja", "passed", Some(&invalid), None);
        assert!(report.contains("\"stdout_utf8_valid\":false"));
        assert!(report.contains("\"stdout_hex\":\"ffc300\""));
    }

    #[test]
    fn diagnostic_output_is_bounded_and_retains_original_unicode_crlf_positions() {
        let errors = vec![
            naja_frontend::Diagnostic {
                code: "NJA999",
                message: "test diagnostic".into(),
                span: naja_frontend::Span::new(5, 5)
            };
            10_000
        ];
        let output = diagnostics(Path::new("source.py"), "é\r\na", &errors);
        assert_eq!(output.lines().count(), 33);
        assert!(output.starts_with("source.py:2:2: NJA999"));
        assert!(output.ends_with("9968 additional diagnostics omitted"));
    }
}
