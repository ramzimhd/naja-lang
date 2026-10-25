//! Development-only line/RPN fixture adapter. This is not NAJA source syntax.
use naja_native::{
    Binary, Comparison,
    hosted::{self, Condition, Expression as E, Statement as S},
};
use std::{
    env, fs,
    io::{Read, Write},
    process::ExitCode,
};

fn expression(text: &str) -> Result<E, String> {
    let mut stack: Vec<(E, usize)> = Vec::new();
    for token in text.split_whitespace() {
        if let Some(slot) = token.strip_prefix('%') {
            stack.push((
                E::Local(slot.parse().map_err(|_| "invalid fixture local")?),
                0,
            ));
        } else if token == "neg" {
            let (value, depth) = stack.pop().ok_or("fixture stack underflow")?;
            if depth >= 128 {
                return Err("fixture expression depth limit".into());
            }
            stack.push((E::Negate(Box::new(value)), depth + 1));
        } else if ["+", "-", "*"].contains(&token) {
            let (right, right_depth) = stack.pop().ok_or("fixture stack underflow")?;
            let (left, left_depth) = stack.pop().ok_or("fixture stack underflow")?;
            let depth = left_depth.max(right_depth) + 1;
            if depth > 128 {
                return Err("fixture expression depth limit".into());
            }
            stack.push((
                E::Binary(
                    match token {
                        "+" => Binary::Add,
                        "-" => Binary::Subtract,
                        _ => Binary::Multiply,
                    },
                    Box::new(left),
                    Box::new(right),
                ),
                depth,
            ));
        } else {
            stack.push((E::Integer(token.into()), 0));
        }
        if stack.len() > 10000 {
            return Err("fixture expression stack limit".into());
        }
    }
    if stack.len() != 1 {
        return Err("fixture expression must leave exactly one value".into());
    }
    Ok(stack.pop().unwrap().0)
}
fn condition(text: &str) -> Result<Condition, String> {
    let (operator, operands) = text.split_once(' ').ok_or("fixture comparison missing")?;
    let (left, right) = operands
        .split_once(" | ")
        .ok_or("fixture comparison separator missing")?;
    let comparison = match operator {
        "==" => Comparison::Equal,
        "!=" => Comparison::NotEqual,
        "<" => Comparison::Less,
        "<=" => Comparison::LessEqual,
        ">" => Comparison::Greater,
        ">=" => Comparison::GreaterEqual,
        _ => return Err("unsupported fixture comparison".into()),
    };
    Ok(Condition {
        left: expression(left)?,
        comparison,
        right: expression(right)?,
    })
}
fn block(lines: &[&str], cursor: &mut usize, depth: usize) -> Result<Vec<S>, String> {
    if depth > 64 {
        return Err("fixture suite depth limit".into());
    }
    let mut output = Vec::new();
    while *cursor < lines.len() {
        let line = lines[*cursor].trim();
        if line == "end" || line == "else" {
            break;
        }
        *cursor += 1;
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(value) = line.strip_prefix("print ") {
            output.push(S::Print(expression(value)?));
        } else if let Some(value) = line.strip_prefix("set ") {
            let (slot, expression_) = value.split_once(' ').ok_or("fixture assignment missing")?;
            output.push(S::Assign(
                slot.parse().map_err(|_| "invalid fixture local")?,
                expression(expression_)?,
            ));
        } else if let Some(value) = line.strip_prefix("if ") {
            let condition = condition(value)?;
            let yes = block(lines, cursor, depth + 1)?;
            let no = if lines.get(*cursor).map(|line| line.trim()) == Some("else") {
                *cursor += 1;
                block(lines, cursor, depth + 1)?
            } else {
                Vec::new()
            };
            if lines.get(*cursor).map(|line| line.trim()) != Some("end") {
                return Err("fixture if lacks end".into());
            }
            *cursor += 1;
            output.push(S::If(condition, yes, no));
        } else if let Some(value) = line.strip_prefix("while ") {
            let condition = condition(value)?;
            let body = block(lines, cursor, depth + 1)?;
            if lines.get(*cursor).map(|line| line.trim()) != Some("end") {
                return Err("fixture while lacks end".into());
            }
            *cursor += 1;
            output.push(S::While(condition, body));
        } else if line == "group" {
            let body = block(lines, cursor, depth + 1)?;
            if lines.get(*cursor).map(|line| line.trim()) != Some("end") {
                return Err("fixture group lacks end".into());
            }
            *cursor += 1;
            output.push(S::Group(body));
        } else {
            return Err("unknown fixture command".into());
        }
    }
    Ok(output)
}
fn run() -> Result<(), String> {
    let args: Vec<_> = env::args_os().skip(1).collect();
    if args.len() != 2 {
        return Err(
            "Usage: hosted_ir INPUT.ir NEW_OUTPUT.elf (development fixture adapter only)".into(),
        );
    }
    let mut bytes = Vec::new();
    fs::File::open(&args[0])
        .map_err(|error| error.to_string())?
        .take(2 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    if bytes.len() > 2 * 1024 * 1024 {
        return Err("fixture input exceeds 2 MiB".into());
    }
    let text = String::from_utf8(bytes).map_err(|_| "fixture input must be UTF-8")?;
    let lines: Vec<_> = text.lines().collect();
    if lines.len() > 10000 {
        return Err("fixture input exceeds 10000 lines".into());
    }
    let mut cursor = 0;
    let statements = block(&lines, &mut cursor, 0)?;
    if cursor != lines.len() {
        return Err("unexpected fixture block terminator".into());
    }
    let elf = hosted::emit_elf(&statements)?;
    let mut file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&args[1])
        .map_err(|error| error.to_string())?;
    file.write_all(&elf).map_err(|error| error.to_string())?;
    Ok(())
}
fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            ExitCode::FAILURE
        }
    }
}
