use std::{
    env,
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::Path,
    process::ExitCode,
};

const HELP: &str = "NAJA HATCH 0.0.1 experimental Rust seed\n\nUsage:\n  naja --version\n  naja lex SOURCE\n  naja check SOURCE\n  naja build SOURCE --target x86_64-unknown-linux-gnu --output NEW_FILE\n\nThis seed supports a bounded explicit checked-i64 subset only.\n.naja selects edition 2026.1 with brace suites, named sections and indentation depth markers.\n.py keeps the separate compatibility dialect.\nFull grammar, hosted int, aliases and self-hosting remain unimplemented.\nBuild never runs user code and refuses to overwrite an existing output.\n";

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("{message}");
            ExitCode::from(1)
        }
    }
}

fn run() -> Result<(), String> {
    let arguments: Vec<_> = env::args_os().skip(1).collect();
    if arguments.len() == 1 && (arguments[0] == "--help" || arguments[0] == "-h") {
        print!("{HELP}");
        return Ok(());
    }
    if arguments.len() == 1 && arguments[0] == "--version" {
        println!(
            "naja 0.0.1 HATCH experimental Rust seed; native target Linux x86-64; no self-hosting claim"
        );
        return Ok(());
    }
    if arguments.len() < 2 {
        return Err(format!("NJA001: invalid arguments\n{HELP}"));
    }
    let operation = arguments[0]
        .to_str()
        .ok_or("NJA001: command must be UTF-8")?;
    if !matches!(operation, "lex" | "check" | "build") {
        return Err(format!("NJA001: unknown command '{operation}'\n{HELP}"));
    }
    let path = Path::new(&arguments[1]);
    if !matches!(
        path.extension().and_then(|value| value.to_str()),
        Some("py" | "naja")
    ) {
        return Err("NJA002: source extension must be .py or .naja".into());
    }
    let mut target = false;
    let mut output = None;
    if operation == "build" {
        let mut index = 2;
        while index < arguments.len() {
            if index + 1 == arguments.len() {
                return Err("NJA001: missing option value".into());
            }
            if arguments[index] == "--target" && !target {
                if arguments[index + 1] != "x86_64-unknown-linux-gnu" {
                    return Err("NJA003: the native spike emits Linux x86-64 ELF only".into());
                }
                target = true;
            } else if arguments[index] == "--output" && output.is_none() {
                output = Some(Path::new(&arguments[index + 1]));
            } else {
                return Err("NJA001: unknown or duplicate build option".into());
            }
            index += 2;
        }
        if !target || output.is_none() {
            return Err(
                "NJA001: build requires --target x86_64-unknown-linux-gnu and --output NEW_FILE"
                    .into(),
            );
        }
    } else if arguments.len() != 2 {
        return Err("NJA001: unexpected arguments".into());
    }
    let file = fs::File::open(path)
        .map_err(|error| format!("NJA004: cannot open {}: {error}", path.display()))?;
    let mut bytes = Vec::new();
    file.take(1_048_577)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("NJA004: cannot read source: {error}"))?;
    if bytes.len() > 1_048_576 {
        return Err("NJA100: source exceeds the experimental 1 MiB limit".into());
    }
    let source = String::from_utf8(bytes).map_err(|_| "NJA005: source must be UTF-8")?;
    let dialect = if path.extension().is_some_and(|value| value == "naja") {
        naja_frontend::Dialect::Naja2026
    } else {
        naja_frontend::Dialect::Python
    };
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
        return Ok(());
    }
    if operation == "check" {
        naja_seed::check_with_dialect(&source, dialect)
            .map_err(|errors| diagnostics(path, &source, &errors))?;
        println!("Checked experimental i64 subset: {}", path.display());
        return Ok(());
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
    let mut file = options.open(output).map_err(|error| {
        format!(
            "NJA006: cannot create new output {}: {error}",
            output.display()
        )
    })?;
    if let Err(error) = file.write_all(&binary) {
        drop(file);
        let _ = fs::remove_file(output);
        return Err(format!("NJA006: cannot write output: {error}"));
    }
    println!(
        "Built Linux x86-64 ELF: {} ({} bytes)",
        output.display(),
        binary.len()
    );
    Ok(())
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
