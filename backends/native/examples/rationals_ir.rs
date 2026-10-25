//! Development-only RPN Rational-program adapter, not a NAJA source frontend.
use naja_native::{
    Binary, Comparison,
    dynamic::{
        self, Class, Expression as E, Function, Method, ObjectProgram, Relation, Statement as S,
    },
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
        let unary = matches!(
            token,
            "num"
                | "den"
                | "dict_keys"
                | "read_file"
                | "encode_utf8"
                | "decode_utf8"
                | "neg"
                | "not"
                | "pos"
                | "len"
                | "require_int"
        );
        let binary = matches!(
            token,
            "rational"
                | "exact"
                | "contains"
                | "write_file"
                | "index"
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
        if let Some(count) = token.strip_prefix("dict:") {
            let count: usize = count
                .parse()
                .map_err(|_| "invalid fixture dictionary count")?;
            if count > dynamic::MAX_MAPPING_ENTRIES || count * 2 > stack.len() {
                return Err("fixture dictionary pairs exceed bounds".into());
            }
            let operands = stack.split_off(stack.len() - count * 2);
            let depth = operands
                .iter()
                .map(|(_, depth)| depth + 1)
                .max()
                .unwrap_or(0);
            if depth > 128 {
                return Err("fixture expression depth limit".into());
            }
            let mut operands = operands.into_iter().map(|(value, _)| value);
            let mut pairs = Vec::new();
            while let Some(key) = operands.next() {
                pairs.push((key, operands.next().unwrap()));
            }
            stack.push((E::Dict(pairs), depth));
        } else if let Some(count) = token.strip_prefix("set:") {
            let count: usize = count.parse().map_err(|_| "invalid fixture set count")?;
            if count > dynamic::MAX_MAPPING_ENTRIES || count > stack.len() {
                return Err("fixture set elements exceed bounds".into());
            }
            let operands = stack.split_off(stack.len() - count);
            let depth = operands
                .iter()
                .map(|(_, depth)| depth + 1)
                .max()
                .unwrap_or(0);
            if depth > 128 {
                return Err("fixture expression depth limit".into());
            }
            stack.push((
                E::Set(operands.into_iter().map(|(value, _)| value).collect()),
                depth,
            ));
        } else if let Some(operators) = token.strip_prefix("relations:") {
            let relations = operators
                .split(',')
                .map(|token| {
                    Ok(match token {
                        "in" => Relation::In,
                        "notin" => Relation::NotIn,
                        _ => Relation::Compare(comparison(token)?),
                    })
                })
                .collect::<Result<Vec<_>, String>>()?;
            if relations.is_empty() || relations.len() > 128 || stack.len() < relations.len() + 1 {
                return Err("fixture relation chain exceeds bounds".into());
            }
            let operands = stack.split_off(stack.len() - relations.len() - 1);
            let depth = operands.iter().map(|(_, depth)| depth + 1).max().unwrap();
            if depth > 128 {
                return Err("fixture expression depth limit".into());
            }
            let mut operands = operands.into_iter().map(|(value, _)| value);
            let first = Box::new(operands.next().unwrap());
            stack.push((
                E::RelationChain(first, relations.into_iter().zip(operands).collect()),
                depth,
            ));
        } else if let Some(name) = token.strip_prefix("get:") {
            let name =
                String::from_utf8(hex(name)?).map_err(|_| "fixture attribute is not UTF-8")?;
            let (object, depth) = stack.pop().ok_or("fixture receiver underflow")?;
            if depth >= 128 {
                return Err("fixture expression depth limit".into());
            }
            stack.push((E::GetAttribute(Box::new(object), name), depth + 1));
        } else if token.starts_with("new:") || token.starts_with("method:") {
            let (head, count) = token
                .rsplit_once(':')
                .ok_or("fixture object call lacks arity")?;
            let count: usize = count.parse().map_err(|_| "invalid fixture object arity")?;
            let method = token.starts_with("method:");
            let consumed = count + usize::from(method);
            if count > 127 || consumed > stack.len() {
                return Err("fixture object arguments exceed bounds".into());
            }
            let operands = stack.split_off(stack.len() - consumed);
            let depth = operands
                .iter()
                .map(|(_, depth)| depth + 1)
                .max()
                .unwrap_or(0);
            if depth > 128 {
                return Err("fixture expression depth limit".into());
            }
            let mut operands = operands.into_iter().map(|(value, _)| value);
            let value = if method {
                let name = String::from_utf8(hex(&head[7..])?)
                    .map_err(|_| "fixture method is not UTF-8")?;
                E::MethodCall(Box::new(operands.next().unwrap()), name, operands.collect())
            } else {
                E::Construct(
                    head[4..]
                        .parse()
                        .map_err(|_| "invalid fixture class index")?,
                    operands.collect(),
                )
            };
            stack.push((value, depth));
        } else if let Some(count) = token.strip_prefix("list:") {
            let count: usize = count.parse().map_err(|_| "invalid fixture list count")?;
            if count > dynamic::MAX_LIST_ELEMENTS || count > stack.len() {
                return Err("fixture list element limit or underflow".into());
            }
            let elements = stack.split_off(stack.len() - count);
            let depth = elements
                .iter()
                .map(|(_, depth)| *depth + 1)
                .max()
                .unwrap_or(0);
            if depth > 128 {
                return Err("fixture expression depth limit".into());
            }
            stack.push((
                E::List(elements.into_iter().map(|(value, _)| value).collect()),
                depth,
            ));
        } else if let Some(count) = token.strip_prefix("tuple:") {
            let count: usize = count.parse().map_err(|_| "invalid fixture tuple count")?;
            if count > dynamic::MAX_TUPLE_ELEMENTS || count > stack.len() {
                return Err("fixture tuple element limit or underflow".into());
            }
            let elements = stack.split_off(stack.len() - count);
            let depth = elements
                .iter()
                .map(|(_, depth)| *depth + 1)
                .max()
                .unwrap_or(0);
            if depth > 128 {
                return Err("fixture expression depth limit".into());
            }
            stack.push((
                E::Tuple(elements.into_iter().map(|(value, _)| value).collect()),
                depth,
            ));
        } else if let Some(call) = token.strip_prefix("call:") {
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
                    "num" => E::Numerator(Box::new(value)),
                    "den" => E::Denominator(Box::new(value)),
                    "dict_keys" => E::DictKeys(Box::new(value)),
                    "read_file" => E::ReadFile(Box::new(value)),
                    "encode_utf8" => E::EncodeUtf8(Box::new(value)),
                    "decode_utf8" => E::DecodeUtf8(Box::new(value)),
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
                "rational" => E::Rational(left, right),
                "exact" => E::DivideExact(left, right),
                "contains" => E::Contains(left, right),
                "write_file" => E::WriteFile {
                    path: left,
                    data: right,
                },
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
        if line == "end"
            || line == "else"
            || line.starts_with("function ")
            || line == "class"
            || line.starts_with("class ")
        {
            break;
        }
        *cursor += 1;
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(parts) = line.strip_prefix("attr ") {
            let parts: Vec<_> = parts.split(" | ").collect();
            if parts.len() != 3 {
                return Err("fixture attr requires VALUE | OBJECT | HEX_NAME".into());
            }
            output.push(S::SetAttribute {
                value: expression(parts[0])?,
                object: expression(parts[1])?,
                name: String::from_utf8(hex(parts[2])?)
                    .map_err(|_| "fixture attribute is not UTF-8")?,
            });
        } else if let Some(parts) = line.strip_prefix("write ") {
            let parts: Vec<_> = parts.split(" | ").collect();
            if parts.len() != 2 {
                return Err("fixture write requires DATA | PATH".into());
            }
            output.push(S::WriteFile {
                data: expression(parts[0])?,
                path: expression(parts[1])?,
            });
        } else if let Some(parts) = line.strip_prefix("store ") {
            let parts: Vec<_> = parts.split(" | ").collect();
            if parts.len() != 3 {
                return Err("fixture store requires VALUE | SEQUENCE | INDEX".into());
            }
            output.push(S::SetIndex {
                value: expression(parts[0])?,
                sequence: expression(parts[1])?,
                index: expression(parts[2])?,
            });
        } else if let Some(value) = line.strip_prefix("eval ") {
            output.push(S::Evaluate(expression(value)?));
        } else if let Some(value) = line.strip_prefix("return ") {
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
            "Usage: rationals_ir INPUT.ir NEW_OUTPUT.elf (development fixture adapter only)".into(),
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
    let mut classes = Vec::new();
    while let Some(header) = lines.get(cursor).map(|line| line.trim()) {
        if header != "class" && !header.starts_with("class ") {
            break;
        }
        if classes.len() >= 128 {
            return Err("fixture exceeds 128 classes".into());
        }
        let mut methods = Vec::new();
        for token in header.strip_prefix("class").unwrap().split_whitespace() {
            let (name, function) = token
                .split_once(':')
                .ok_or("fixture method needs HEX_NAME:FUNCTION")?;
            methods.push(Method {
                name: String::from_utf8(hex(name)?).map_err(|_| "fixture method is not UTF-8")?,
                function: function
                    .parse()
                    .map_err(|_| "invalid fixture method function")?,
            });
            if methods.len() > 128 {
                return Err("fixture exceeds 128 methods".into());
            }
        }
        classes.push(Class { methods });
        cursor += 1;
    }
    if cursor != lines.len() {
        return Err("unexpected fixture suite closer".into());
    }
    let binary = dynamic::emit_object_program(&ObjectProgram {
        body,
        functions,
        classes,
    })?;
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
    println!("Emitted independent Rational ELF ({} bytes)", binary.len());
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
