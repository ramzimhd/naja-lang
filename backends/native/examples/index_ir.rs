//! Development-only RPN index-program adapter, not a NAJA source frontend.
use naja_native::{
    Binary, Comparison,
    dynamic::{self, Expression as E, Function, Program, Statement as S},
};
use std::{
    env, fs,
    io::{Read, Write},
    process::ExitCode,
};

fn hex(value: &str) -> Result<Vec<u8>, String> {
    if !value.len().is_multiple_of(2) {
        return Err("fixture hex must have an even length".into());
    }
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            let digit = |byte: u8| {
                (byte as char)
                    .to_digit(16)
                    .map(|value| value as u8)
                    .ok_or("invalid fixture hex".to_string())
            };
            Ok(digit(pair[0])? * 16 + digit(pair[1])?)
        })
        .collect()
}
fn expression(text: &str) -> Result<E, String> {
    let mut stack: Vec<(E, usize)> = Vec::new();
    for token in text.split_whitespace() {
        let unary = matches!(token, "neg" | "not" | "pos" | "len" | "require_int");
        let binary = matches!(
            token,
            "index"
                | "+"
                | "-"
                | "*"
                | "//"
                | "%"
                | "=="
                | "!="
                | "<"
                | "<="
                | ">"
                | ">="
                | "and"
                | "or"
        );
        if let Some(call) = token.strip_prefix("call:") {
            let (index, count) = call
                .split_once(':')
                .ok_or("fixture call needs index:arity")?;
            let index = index
                .parse()
                .map_err(|_| "invalid fixture function index")?;
            let count: usize = count.parse().map_err(|_| "invalid fixture arity")?;
            if count > 128 || count > stack.len() {
                return Err("fixture call argument limit or underflow".into());
            }
            let arguments = stack.split_off(stack.len() - count);
            let depth = arguments
                .iter()
                .map(|(_, depth)| *depth + 1)
                .max()
                .unwrap_or(0);
            if depth > 128 {
                return Err("fixture expression depth limit".into());
            }
            stack.push((
                E::Call(
                    index,
                    arguments.into_iter().map(|(value, _)| value).collect(),
                ),
                depth,
            ));
        } else if unary {
            let (value, depth) = stack.pop().ok_or("fixture stack underflow")?;
            if depth >= 128 {
                return Err("fixture expression depth limit".into());
            }
            stack.push((
                match token {
                    "neg" => E::Negate(Box::new(value)),
                    "pos" => E::Positive(Box::new(value)),
                    "len" => E::Len(Box::new(value)),
                    "require_int" => E::RequireInteger(Box::new(value)),
                    _ => E::Not(Box::new(value)),
                },
                depth + 1,
            ));
        } else if let Some(operators) = token.strip_prefix("chain:") {
            let operators = operators
                .split(',')
                .map(comparison)
                .collect::<Result<Vec<_>, _>>()?;
            if operators.is_empty() || operators.len() > dynamic::MAX_CHAIN_COMPARISONS {
                return Err("fixture chain requires 1..128 comparisons".into());
            }
            let count = operators.len() + 1;
            if stack.len() < count {
                return Err("fixture chain stack underflow".into());
            }
            let operands = stack.split_off(stack.len() - count);
            let depth = operands.iter().map(|(_, depth)| *depth).max().unwrap() + 1;
            if depth > 128 {
                return Err("fixture expression depth limit".into());
            }
            let mut operands = operands.into_iter();
            let first = Box::new(operands.next().unwrap().0);
            let rest = operators
                .into_iter()
                .zip(operands.map(|(value, _)| value))
                .collect();
            stack.push((E::CompareChain(first, rest), depth));
        } else if binary {
            let (right, rd) = stack.pop().ok_or("fixture stack underflow")?;
            let (left, ld) = stack.pop().ok_or("fixture stack underflow")?;
            let depth = ld.max(rd) + 1;
            if depth > 128 {
                return Err("fixture expression depth limit".into());
            }
            let left = Box::new(left);
            let right = Box::new(right);
            let value = match token {
                "index" => E::Index(left, right),
                "+" => E::Binary(Binary::Add, left, right),
                "-" => E::Binary(Binary::Subtract, left, right),
                "*" => E::Binary(Binary::Multiply, left, right),
                "//" => E::FloorDivide(left, right),
                "%" => E::Modulo(left, right),
                "and" => E::And(left, right),
                "or" => E::Or(left, right),
                _ => E::Compare(comparison(token)?, left, right),
            };
            stack.push((value, depth));
        } else {
            stack.push((
                if let Some(value) = token.strip_prefix("t:") {
                    E::Text(
                        String::from_utf8(hex(value)?).map_err(|_| "fixture text is not UTF-8")?,
                    )
                } else if let Some(value) = token.strip_prefix("b:") {
                    E::Bytes(hex(value)?)
                } else if let Some(value) = token.strip_prefix('%') {
                    E::Local(value.parse().map_err(|_| "invalid fixture local")?)
                } else {
                    match token {
                        "true" => E::Boolean(true),
                        "false" => E::Boolean(false),
                        "none" => E::None,
                        _ => E::Integer(token.into()),
                    }
                },
                0,
            ));
        }
        if stack.len() > 10000 {
            return Err("fixture expression stack limit".into());
        }
    }
    if stack.len() != 1 {
        return Err("fixture expression must leave one value".into());
    }
    Ok(stack.pop().unwrap().0)
}
fn comparison(token: &str) -> Result<Comparison, String> {
    Ok(match token {
        "==" => Comparison::Equal,
        "!=" => Comparison::NotEqual,
        "<" => Comparison::Less,
        "<=" => Comparison::LessEqual,
        ">" => Comparison::Greater,
        ">=" => Comparison::GreaterEqual,
        _ => return Err("invalid fixture comparison".into()),
    })
}
fn block(lines: &[&str], cursor: &mut usize, depth: usize) -> Result<Vec<S>, String> {
    if depth > 64 {
        return Err("fixture suite depth limit".into());
    }
    let mut output = Vec::new();
    while *cursor < lines.len() {
        let line = lines[*cursor].trim();
        if line == "end" || line == "else" || line.starts_with("function ") {
            break;
        }
        *cursor += 1;
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(value) = line.strip_prefix("return ") {
            output.push(S::Return(expression(value)?));
        } else if let Some(value) = line.strip_prefix("print ") {
            output.push(S::Print(expression(value)?));
        } else if let Some(value) = line.strip_prefix("assert ") {
            output.push(S::Assert(expression(value)?));
        } else if let Some(value) = line.strip_prefix("set ") {
            let (slot, value) = value.split_once(' ').ok_or("fixture assignment missing")?;
            output.push(S::Assign(
                slot.parse().map_err(|_| "invalid fixture local")?,
                expression(value)?,
            ));
        } else if line == "group" || line.starts_with("if ") || line.starts_with("while ") {
            let condition = if line == "group" {
                None
            } else {
                Some(expression(line.split_once(' ').unwrap().1)?)
            };
            let body = block(lines, cursor, depth + 1)?;
            let otherwise = if line.starts_with("if ")
                && lines.get(*cursor).map(|line| line.trim()) == Some("else")
            {
                *cursor += 1;
                block(lines, cursor, depth + 1)?
            } else {
                Vec::new()
            };
            if lines.get(*cursor).map(|line| line.trim()) != Some("end") {
                return Err("fixture suite lacks end".into());
            }
            *cursor += 1;
            output.push(if line == "group" {
                S::Group(body)
            } else if line.starts_with("if ") {
                S::If(condition.unwrap(), body, otherwise)
            } else {
                S::While(condition.unwrap(), body)
            });
        } else {
            return Err("unknown fixture statement".into());
        }
    }
    Ok(output)
}
fn run() -> Result<(), String> {
    let args: Vec<_> = env::args_os().skip(1).collect();
    if args.len() != 2 {
        return Err(
            "Usage: index_ir INPUT.ir NEW_OUTPUT.elf (development fixture adapter only)".into(),
        );
    }
    let mut bytes = Vec::new();
    fs::File::open(&args[0])
        .map_err(|error| error.to_string())?
        .take(2 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    if bytes.len() > 2 * 1024 * 1024 {
        return Err("fixture exceeds 2 MiB".into());
    }
    let text = String::from_utf8(bytes).map_err(|_| "fixture source is not UTF-8")?;
    let lines: Vec<_> = text.lines().collect();
    if lines.len() > 10000 {
        return Err("fixture exceeds 10000 lines".into());
    }
    let mut cursor = 0;
    let body = block(&lines, &mut cursor, 0)?;
    let mut functions = Vec::new();
    while let Some(header) = lines.get(cursor).map(|line| line.trim()) {
        let Some(parameters) = header.strip_prefix("function ") else {
            break;
        };
        if functions.len() >= 128 {
            return Err("fixture exceeds 128 functions".into());
        }
        let parameters = parameters
            .parse()
            .map_err(|_| "invalid fixture parameter count")?;
        cursor += 1;
        let body = block(&lines, &mut cursor, 0)?;
        if lines.get(cursor).map(|line| line.trim()) != Some("end") {
            return Err("fixture function lacks end".into());
        }
        cursor += 1;
        while lines
            .get(cursor)
            .is_some_and(|line| line.trim().is_empty() || line.trim().starts_with('#'))
        {
            cursor += 1;
        }
        functions.push(Function { parameters, body });
    }
    if cursor != lines.len() {
        return Err("unexpected fixture suite closer".into());
    }
    let binary = dynamic::emit_program(&Program { body, functions })?;
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o700);
    }
    let mut output = options.open(&args[1]).map_err(|error| error.to_string())?;
    if let Err(error) = output.write_all(&binary) {
        drop(output);
        let _ = fs::remove_file(&args[1]);
        return Err(error.to_string());
    }
    println!(
        "Emitted independent sequence-index ELF ({} bytes)",
        binary.len()
    );
    Ok(())
}
fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            ExitCode::from(1)
        }
    }
}
