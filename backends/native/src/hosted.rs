//! Experimental hosted-integer IR and direct Linux x86-64 backend.
//! Immutable base-1e9 values use an explicitly bounded temporary arena.
use super::{Binary, Comparison, MAX_LOCALS};
pub(crate) mod runtime;
pub(crate) mod x64;

pub const ARENA_BYTES: usize = 64 * 1024 * 1024;
const MAX_DIGITS: usize = 1_048_576;
const MAX_NODES: usize = 10_000;

#[derive(Clone, Debug)]
pub enum Expression {
    Integer(String),
    Local(usize),
    Negate(Box<Expression>),
    Binary(Binary, Box<Expression>, Box<Expression>),
}

#[derive(Clone, Debug)]
pub struct Condition {
    pub left: Expression,
    pub comparison: Comparison,
    pub right: Expression,
}

#[derive(Clone, Debug)]
pub enum Statement {
    Assert(Condition),
    Assign(usize, Expression),
    Print(Expression),
    If(Condition, Vec<Statement>, Vec<Statement>),
    While(Condition, Vec<Statement>),
    Group(Vec<Statement>),
}

// Chunk at most nine decimal digits into each u32 limb. The complete integer
// never passes through a fixed-width scalar or floating-point conversion.
pub(crate) fn decimal(value: &str) -> Result<(i64, Vec<u32>), String> {
    let (negative, digits) = value
        .strip_prefix('-')
        .map_or((false, value), |v| (true, v));
    if digits.is_empty() || !digits.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err("hosted integer IR requires an optional minus and ASCII decimal digits".into());
    }
    if digits.len() > MAX_DIGITS {
        return Err("hosted integer literal exceeds the 1 MiB digit budget".into());
    }
    let digits = digits.trim_start_matches('0');
    if digits.is_empty() {
        return Ok((0, Vec::new()));
    }
    let mut limbs = Vec::with_capacity(digits.len().div_ceil(9));
    let mut end = digits.len();
    while end > 0 {
        let start = end.saturating_sub(9);
        limbs.push(
            digits[start..end]
                .parse::<u32>()
                .map_err(|_| "invalid decimal limb")?,
        );
        end = start;
    }
    Ok((if negative { -1 } else { 1 }, limbs))
}

struct Validator {
    nodes: usize,
    digits: usize,
}
impl Validator {
    fn account(&mut self) -> Result<(), String> {
        self.nodes += 1;
        if self.nodes > MAX_NODES {
            return Err("hosted IR exceeds 10000 nodes".into());
        }
        Ok(())
    }
    fn expression(
        &mut self,
        expression: &Expression,
        initialized: &[bool; MAX_LOCALS],
        depth: usize,
    ) -> Result<(), String> {
        self.account()?;
        if depth > 128 {
            return Err("hosted expression nesting exceeds 128".into());
        }
        match expression {
            Expression::Integer(value) => {
                self.digits += value.len();
                if self.digits > MAX_DIGITS {
                    return Err("hosted IR exceeds the 1 MiB aggregate literal budget".into());
                }
                decimal(value)?;
            }
            Expression::Local(slot) => {
                if *slot >= MAX_LOCALS || !initialized[*slot] {
                    return Err("hosted IR reads an uninitialized or out-of-frame local".into());
                }
            }
            Expression::Negate(value) => self.expression(value, initialized, depth + 1)?,
            Expression::Binary(_, left, right) => {
                self.expression(left, initialized, depth + 1)?;
                self.expression(right, initialized, depth + 1)?;
            }
        }
        Ok(())
    }
    fn condition(
        &mut self,
        condition: &Condition,
        initialized: &[bool; MAX_LOCALS],
    ) -> Result<(), String> {
        self.expression(&condition.left, initialized, 0)?;
        self.expression(&condition.right, initialized, 0)
    }
    fn statements(
        &mut self,
        statements: &[Statement],
        initialized: &mut [bool; MAX_LOCALS],
        depth: usize,
    ) -> Result<(), String> {
        if depth > 64 {
            return Err("hosted suite nesting exceeds 64".into());
        }
        for statement in statements {
            self.account()?;
            match statement {
                Statement::Assign(slot, value) => {
                    if *slot >= MAX_LOCALS {
                        return Err("hosted local exceeds the 128-slot frame".into());
                    }
                    self.expression(value, initialized, 0)?;
                    initialized[*slot] = true;
                }
                Statement::Print(value) => self.expression(value, initialized, 0)?,
                Statement::Assert(condition) => self.condition(condition, initialized)?,
                Statement::Group(body) => self.statements(body, initialized, depth + 1)?,
                Statement::If(condition, yes, no) => {
                    self.condition(condition, initialized)?;
                    let mut a = *initialized;
                    let mut b = *initialized;
                    self.statements(yes, &mut a, depth + 1)?;
                    self.statements(no, &mut b, depth + 1)?;
                    for index in 0..MAX_LOCALS {
                        initialized[index] = a[index] && b[index];
                    }
                }
                Statement::While(condition, body) => {
                    self.condition(condition, initialized)?;
                    let mut body_state = *initialized;
                    self.statements(body, &mut body_state, depth + 1)?;
                }
            }
        }
        Ok(())
    }
}

/// Validate resource bounds and definite initialization before native emission.
pub fn validate(statements: &[Statement]) -> Result<(), String> {
    if statements.is_empty() {
        return Err("hosted IR has no executable statements".into());
    }
    Validator {
        nodes: 0,
        digits: 0,
    }
    .statements(statements, &mut [false; MAX_LOCALS], 0)
}

struct Emitter {
    code: x64::Code,
    runtime: runtime::Runtime,
    literals: Vec<(usize, i64, Vec<u32>)>,
}
impl Emitter {
    fn expression(&mut self, expression: &Expression) -> Result<(), String> {
        use x64::R::*;
        match expression {
            Expression::Integer(value) => {
                let (sign, limbs) = decimal(value)?;
                let label = self.code.label();
                self.literals.push((label, sign, limbs));
                self.code.lea(Ax, label);
            }
            Expression::Local(slot) => self.code.load(Ax, Bp, -8 * (*slot as i32 + 1)),
            Expression::Negate(value) => {
                self.expression(value)?;
                self.code.call(self.runtime.negate);
            }
            Expression::Binary(operator, left, right) => {
                self.expression(left)?;
                self.code.push(Ax);
                self.expression(right)?;
                self.code.mov(Si, Ax);
                self.code.pop(Di);
                self.code.call(match operator {
                    Binary::Add => self.runtime.add,
                    Binary::Subtract => self.runtime.subtract,
                    Binary::Multiply => self.runtime.multiply,
                });
            }
        }
        Ok(())
    }
    fn condition_false(&mut self, condition: &Condition, target: usize) -> Result<(), String> {
        use x64::R::*;
        self.expression(&condition.left)?;
        self.code.push(Ax);
        self.expression(&condition.right)?;
        self.code.mov(Si, Ax);
        self.code.pop(Di);
        self.code.call(self.runtime.compare);
        self.code.immediate(7, Ax, 0);
        self.code.j(
            match condition.comparison {
                Comparison::Equal => 0x85,
                Comparison::NotEqual => 0x84,
                Comparison::Less => 0x8d,
                Comparison::LessEqual => 0x8f,
                Comparison::Greater => 0x8e,
                Comparison::GreaterEqual => 0x8c,
            },
            target,
        );
        Ok(())
    }
    fn statements(&mut self, statements: &[Statement]) -> Result<(), String> {
        use x64::R::*;
        for statement in statements {
            match statement {
                Statement::Assign(slot, value) => {
                    self.expression(value)?;
                    self.code.store(Bp, -8 * (*slot as i32 + 1), Ax);
                }
                Statement::Print(value) => {
                    self.expression(value)?;
                    self.code.call(self.runtime.print);
                }
                Statement::Group(body) => self.statements(body)?,
                Statement::Assert(condition) => {
                    self.condition_false(condition, self.runtime.assertion)?
                }
                Statement::If(condition, yes, no) => {
                    let otherwise = self.code.label();
                    let end = self.code.label();
                    self.condition_false(condition, otherwise)?;
                    self.statements(yes)?;
                    self.code.jump(end);
                    self.code.bind(otherwise);
                    self.statements(no)?;
                    self.code.bind(end);
                }
                Statement::While(condition, body) => {
                    let start = self.code.label();
                    let end = self.code.label();
                    self.code.bind(start);
                    self.condition_false(condition, end)?;
                    self.statements(body)?;
                    self.code.jump(start);
                    self.code.bind(end);
                }
            }
        }
        Ok(())
    }
}

/// Emit bounded hosted-integer native code without invoking another compiler,
/// assembler, linker or interpreter. The arena is not a general memory manager.
pub fn emit_elf(statements: &[Statement]) -> Result<Vec<u8>, String> {
    validate(statements)?;
    let mut code = x64::Code::new();
    let runtime = runtime::Runtime::new(&mut code);
    let mut emitter = Emitter {
        code,
        runtime,
        literals: Vec::new(),
    };
    emitter.runtime.start(&mut emitter.code);
    emitter.statements(statements)?;
    emitter.code.exit(0);
    emitter.runtime.emit(&mut emitter.code);
    for (label, sign, limbs) in emitter.literals {
        emitter.code.align();
        emitter.code.bind(label);
        emitter.code.a.bytes(&sign.to_le_bytes());
        emitter.code.a.bytes(&(limbs.len() as u64).to_le_bytes());
        for limb in limbs {
            emitter.code.a.bytes(&limb.to_le_bytes());
        }
    }
    super::elf_image(emitter.code.a.finish()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn decimal_preserves_values_beyond_machine_width_and_normalizes_zero() {
        assert_eq!(
            decimal("123456789012345678901234567890").unwrap(),
            (1, vec![234_567_890, 345_678_901, 456_789_012, 123])
        );
        assert_eq!(decimal("-000000000000000000000").unwrap(), (0, vec![]));
        assert_eq!(
            decimal("-1000000000000000001").unwrap(),
            (-1, vec![1, 0, 1])
        );
    }
    #[test]
    fn invalid_literals_are_rejected_without_conversion_or_truncation() {
        for value in ["", "-", "+1", "1_000", "1.0", "0xff", "１２"] {
            assert!(decimal(value).is_err(), "{value}");
        }
        assert!(decimal(&"1".repeat(MAX_DIGITS + 1)).is_err());
    }
    #[test]
    fn local_use_must_be_initialized_on_every_executed_path() {
        assert!(validate(&[Statement::Print(Expression::Local(0))]).is_err());
        assert!(
            validate(&[Statement::Assign(
                MAX_LOCALS,
                Expression::Integer("0".into())
            )])
            .is_err()
        );
        let condition = Condition {
            left: Expression::Integer("0".into()),
            comparison: Comparison::Equal,
            right: Expression::Integer("0".into()),
        };
        let assign = Statement::Assign(0, Expression::Integer("1".into()));
        assert!(
            validate(&[
                Statement::If(condition.clone(), vec![assign.clone()], vec![]),
                Statement::Print(Expression::Local(0))
            ])
            .is_err()
        );
        assert!(
            validate(&[
                Statement::If(
                    condition.clone(),
                    vec![assign.clone()],
                    vec![assign.clone()]
                ),
                Statement::Print(Expression::Local(0))
            ])
            .is_ok()
        );
        assert!(
            validate(&[
                Statement::While(condition, vec![assign]),
                Statement::Print(Expression::Local(0))
            ])
            .is_err()
        );
    }

    #[test]
    fn emitter_validates_limits_and_has_no_interpreter_or_writable_code() {
        let value = Expression::Integer("1844674407370955161618446744073709551616".into());
        let program = [Statement::Print(value.clone())];
        let elf = emit_elf(&program).unwrap();
        assert_eq!(elf, emit_elf(&program).unwrap());
        assert_eq!(&elf[..4], b"\x7fELF");
        assert_eq!(u16::from_le_bytes(elf[56..58].try_into().unwrap()), 2);
        assert_eq!(u32::from_le_bytes(elf[64..68].try_into().unwrap()), 1);
        assert_eq!(u32::from_le_bytes(elf[68..72].try_into().unwrap()), 5);
        assert_eq!(
            u32::from_le_bytes(elf[120..124].try_into().unwrap()),
            0x6474e551
        );
        assert_eq!(u32::from_le_bytes(elf[124..128].try_into().unwrap()), 6);
        assert!(emit_elf(&[]).is_err());
        assert!(emit_elf(&[Statement::Print(Expression::Local(0))]).is_err());
        let mut deep = value;
        for _ in 0..140 {
            deep = Expression::Negate(Box::new(deep));
        }
        assert!(emit_elf(&[Statement::Print(deep)]).is_err());
        assert!(
            emit_elf(&vec![
                Statement::Print(Expression::Integer("1".into()));
                MAX_NODES
            ])
            .is_err()
        );
        let mut suite = Statement::Print(Expression::Integer("1".into()));
        for _ in 0..66 {
            suite = Statement::Group(vec![suite]);
        }
        assert!(emit_elf(&[suite]).is_err());
    }
}
