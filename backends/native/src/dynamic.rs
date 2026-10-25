//! Experimental immutable native values. This private layout is not a language ABI.
use super::{
    Binary, Comparison, MAX_LOCALS,
    hosted::{
        self, runtime,
        x64::{Code, R::*},
    },
};
mod routines;

pub const ARENA_BYTES: usize = hosted::ARENA_BYTES;
const MAX_LITERAL_BYTES: usize = 1_048_576;
const MAX_NODES: usize = 10_000;

#[derive(Clone, Debug)]
pub enum Expression {
    Integer(String),
    Text(String),
    Bytes(Vec<u8>),
    Boolean(bool),
    None,
    Local(usize),
    Negate(Box<Self>),
    Binary(Binary, Box<Self>, Box<Self>),
    Compare(Comparison, Box<Self>, Box<Self>),
    Not(Box<Self>),
    And(Box<Self>, Box<Self>),
    Or(Box<Self>, Box<Self>),
}

#[derive(Clone, Debug)]
pub enum Statement {
    Assign(usize, Expression),
    Print(Expression),
    Assert(Expression),
    If(Expression, Vec<Self>, Vec<Self>),
    While(Expression, Vec<Self>),
    Group(Vec<Self>),
}

struct Validator {
    nodes: usize,
    literals: usize,
}
impl Validator {
    fn account(&mut self) -> Result<(), String> {
        self.nodes += 1;
        if self.nodes > MAX_NODES {
            return Err("dynamic IR exceeds 10000 nodes".into());
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
            return Err("dynamic expression nesting exceeds 128".into());
        }
        let literal = match expression {
            Expression::Integer(value) => {
                hosted::decimal(value)?;
                value.len()
            }
            Expression::Text(value) => value.len(),
            Expression::Bytes(value) => value.len(),
            Expression::Boolean(_) | Expression::None => 0,
            Expression::Local(slot) => {
                if *slot >= MAX_LOCALS || !initialized[*slot] {
                    return Err("dynamic IR reads an uninitialized or out-of-frame local".into());
                }
                0
            }
            Expression::Negate(value) | Expression::Not(value) => {
                self.expression(value, initialized, depth + 1)?;
                0
            }
            Expression::Binary(_, left, right)
            | Expression::Compare(_, left, right)
            | Expression::And(left, right)
            | Expression::Or(left, right) => {
                self.expression(left, initialized, depth + 1)?;
                self.expression(right, initialized, depth + 1)?;
                0
            }
        };
        self.literals += literal;
        if self.literals > MAX_LITERAL_BYTES {
            return Err("dynamic IR exceeds the 1 MiB aggregate literal budget".into());
        }
        Ok(())
    }
    fn statements(
        &mut self,
        statements: &[Statement],
        initialized: &mut [bool; MAX_LOCALS],
        depth: usize,
    ) -> Result<(), String> {
        if depth > 64 {
            return Err("dynamic suite nesting exceeds 64".into());
        }
        for statement in statements {
            self.account()?;
            match statement {
                Statement::Assign(slot, value) => {
                    if *slot >= MAX_LOCALS {
                        return Err("dynamic local exceeds the 128-slot frame".into());
                    }
                    self.expression(value, initialized, 0)?;
                    initialized[*slot] = true;
                }
                Statement::Print(value) | Statement::Assert(value) => {
                    self.expression(value, initialized, 0)?
                }
                Statement::Group(body) => self.statements(body, initialized, depth + 1)?,
                Statement::If(condition, yes, no) => {
                    self.expression(condition, initialized, 0)?;
                    let mut a = *initialized;
                    let mut b = *initialized;
                    self.statements(yes, &mut a, depth + 1)?;
                    self.statements(no, &mut b, depth + 1)?;
                    for index in 0..MAX_LOCALS {
                        initialized[index] = a[index] && b[index];
                    }
                }
                Statement::While(condition, body) => {
                    self.expression(condition, initialized, 0)?;
                    let mut body_state = *initialized;
                    self.statements(body, &mut body_state, depth + 1)?;
                }
            }
        }
        Ok(())
    }
}

pub fn validate(statements: &[Statement]) -> Result<(), String> {
    if statements.is_empty() {
        return Err("dynamic IR has no executable statements".into());
    }
    Validator {
        nodes: 0,
        literals: 0,
    }
    .statements(statements, &mut [false; MAX_LOCALS], 0)
}

enum Literal {
    Int(usize, i64, Vec<u32>),
    Sequence(usize, u64, Vec<u8>),
}
struct Emitter {
    code: Code,
    integers: runtime::Runtime,
    runtime: routines::Runtime,
    literals: Vec<Literal>,
}
impl Emitter {
    fn expression(&mut self, expression: &Expression) -> Result<(), String> {
        match expression {
            Expression::Integer(value) => {
                let (sign, limbs) = hosted::decimal(value)?;
                let label = self.code.label();
                self.literals.push(Literal::Int(label, sign, limbs));
                self.code.lea(Ax, label);
            }
            Expression::Text(value) => self.sequence(1, value.as_bytes()),
            Expression::Bytes(value) => self.sequence(2, value),
            Expression::Boolean(value) => self.code.lea(
                Ax,
                if *value {
                    self.runtime.true_value
                } else {
                    self.runtime.false_value
                },
            ),
            Expression::None => self.code.lea(Ax, self.runtime.none_value),
            Expression::Local(slot) => self.code.load(Ax, Bp, -8 * (*slot as i32 + 1)),
            Expression::Negate(value) => {
                self.expression(value)?;
                self.code.call(self.runtime.negate);
            }
            Expression::Not(value) => {
                self.expression(value)?;
                self.code.call(self.runtime.truth);
                self.code.immediate(7, Ax, 0);
                self.boolean(0x84);
            }
            Expression::Binary(operator, left, right) => {
                self.operands(left, right)?;
                self.code.call(match operator {
                    Binary::Add => self.runtime.add,
                    Binary::Subtract => self.runtime.subtract,
                    Binary::Multiply => self.runtime.multiply,
                });
            }
            Expression::Compare(comparison, left, right) => {
                self.operands(left, right)?;
                self.code.call(self.runtime.compare);
                if matches!(comparison, Comparison::Equal | Comparison::NotEqual) {
                    let ordinary = self.code.label();
                    self.code.immediate(7, Ax, 3);
                    self.code.j(0x85, ordinary);
                    self.code.zero(Ax);
                    self.code.bind(ordinary);
                } else {
                    self.code.immediate(7, Ax, 2);
                    self.code.j(0x8d, self.runtime.type_error);
                }
                self.code.immediate(7, Ax, 0);
                self.boolean(match comparison {
                    Comparison::Equal => 0x84,
                    Comparison::NotEqual => 0x85,
                    Comparison::Less => 0x8c,
                    Comparison::LessEqual => 0x8e,
                    Comparison::Greater => 0x8f,
                    Comparison::GreaterEqual => 0x8d,
                });
            }
            Expression::And(left, right) | Expression::Or(left, right) => {
                self.expression(left)?;
                self.code.push(Ax);
                self.code.call(self.runtime.truth);
                self.code.immediate(7, Ax, 0);
                let skip = self.code.label();
                let end = self.code.label();
                self.code.j(
                    if matches!(expression, Expression::And(..)) {
                        0x84
                    } else {
                        0x85
                    },
                    skip,
                );
                self.code.pop(Ax);
                self.expression(right)?;
                self.code.jump(end);
                self.code.bind(skip);
                self.code.pop(Ax);
                self.code.bind(end);
            }
        }
        Ok(())
    }
    fn sequence(&mut self, tag: u64, value: &[u8]) {
        let label = self.code.label();
        self.literals
            .push(Literal::Sequence(label, tag, value.to_vec()));
        self.code.lea(Ax, label);
    }
    fn operands(&mut self, left: &Expression, right: &Expression) -> Result<(), String> {
        self.expression(left)?;
        self.code.push(Ax);
        self.expression(right)?;
        self.code.mov(Si, Ax);
        self.code.pop(Di);
        Ok(())
    }
    fn boolean(&mut self, condition: u8) {
        let yes = self.code.label();
        let end = self.code.label();
        self.code.j(condition, yes);
        self.code.lea(Ax, self.runtime.false_value);
        self.code.jump(end);
        self.code.bind(yes);
        self.code.lea(Ax, self.runtime.true_value);
        self.code.bind(end);
    }
    fn condition_false(&mut self, value: &Expression, end: usize) -> Result<(), String> {
        self.expression(value)?;
        self.code.call(self.runtime.truth);
        self.code.immediate(7, Ax, 0);
        self.code.j(0x84, end);
        Ok(())
    }
    fn statements(&mut self, statements: &[Statement]) -> Result<(), String> {
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
                Statement::Assert(value) => self.condition_false(value, self.integers.assertion)?,
                Statement::Group(body) => self.statements(body)?,
                Statement::If(value, yes, no) => {
                    let otherwise = self.code.label();
                    let end = self.code.label();
                    self.condition_false(value, otherwise)?;
                    self.statements(yes)?;
                    self.code.jump(end);
                    self.code.bind(otherwise);
                    self.statements(no)?;
                    self.code.bind(end);
                }
                Statement::While(value, body) => {
                    let start = self.code.label();
                    let end = self.code.label();
                    self.code.bind(start);
                    self.condition_false(value, end)?;
                    self.statements(body)?;
                    self.code.jump(start);
                    self.code.bind(end);
                }
            }
        }
        Ok(())
    }
}

fn pointer(code: &mut Code, label: usize, patches: &mut Vec<(usize, usize)>) {
    patches.push((code.a.code.len(), label));
    code.a.bytes(&[0; 8]);
}
fn descriptor(
    code: &mut Code,
    label: usize,
    tag: u64,
    data: usize,
    length: usize,
    patches: &mut Vec<(usize, usize)>,
) {
    code.align();
    code.bind(label);
    code.a.bytes(&tag.to_le_bytes());
    pointer(code, data, patches);
    code.a.bytes(&(length as u64).to_le_bytes());
}

pub fn emit_elf(statements: &[Statement]) -> Result<Vec<u8>, String> {
    validate(statements)?;
    let mut code = Code::new();
    let integers = runtime::Runtime::new(&mut code);
    let runtime = routines::Runtime::new(&mut code);
    let mut emitter = Emitter {
        code,
        integers,
        runtime,
        literals: Vec::new(),
    };
    emitter.integers.start(&mut emitter.code);
    emitter.statements(statements)?;
    emitter.code.exit(0);
    emitter.runtime.emit(&mut emitter.code, &emitter.integers);
    emitter
        .integers
        .emit_with_resource_message(&mut emitter.code, b"NJA203: native value arena exhausted\n");
    let mut patches = Vec::new();
    let one = emitter.code.label();
    emitter.code.align();
    emitter.code.bind(one);
    emitter.code.a.bytes(&1_i64.to_le_bytes());
    emitter.code.a.bytes(&1_u64.to_le_bytes());
    emitter.code.a.bytes(&1_u32.to_le_bytes());
    descriptor(
        &mut emitter.code,
        emitter.runtime.true_value,
        3,
        one,
        0,
        &mut patches,
    );
    descriptor(
        &mut emitter.code,
        emitter.runtime.false_value,
        3,
        emitter.integers.zero,
        0,
        &mut patches,
    );
    descriptor(
        &mut emitter.code,
        emitter.runtime.none_value,
        4,
        emitter.integers.zero,
        0,
        &mut patches,
    );
    for literal in emitter.literals {
        match literal {
            Literal::Int(label, sign, limbs) => {
                let object = emitter.code.label();
                descriptor(&mut emitter.code, label, 0, object, 0, &mut patches);
                emitter.code.bind(object);
                emitter.code.a.bytes(&sign.to_le_bytes());
                emitter.code.a.bytes(&(limbs.len() as u64).to_le_bytes());
                for limb in limbs {
                    emitter.code.a.bytes(&limb.to_le_bytes());
                }
            }
            Literal::Sequence(label, tag, bytes) => {
                let data = emitter.code.label();
                descriptor(
                    &mut emitter.code,
                    label,
                    tag,
                    data,
                    bytes.len(),
                    &mut patches,
                );
                emitter.code.bind(data);
                emitter.code.a.bytes(&bytes);
            }
        }
    }
    for (offset, label) in patches {
        let target = emitter.code.a.labels[label].ok_or("unbound native value data")?;
        let address = super::BASE + super::HEADER_SIZE as u64 + target as u64;
        emitter.code.a.code[offset..offset + 8].copy_from_slice(&address.to_le_bytes());
    }
    super::elf_image(emitter.code.a.finish()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_ir_limits_and_initialization_are_rejected() {
        assert!(emit_elf(&[]).is_err());
        for value in ["", "-", "1_000", "+1", "１２", "1.0"] {
            assert!(validate(&[Statement::Print(Expression::Integer(value.into()))]).is_err());
        }
        assert!(validate(&[Statement::Print(Expression::Local(0))]).is_err());
        assert!(validate(&[Statement::Assign(MAX_LOCALS, Expression::None)]).is_err());
        let assign = Statement::Assign(0, Expression::Text("yes".into()));
        for control in [
            Statement::If(Expression::Boolean(true), vec![assign.clone()], vec![]),
            Statement::While(Expression::Boolean(false), vec![assign.clone()]),
        ] {
            assert!(validate(&[control, Statement::Print(Expression::Local(0))]).is_err());
        }
        assert!(
            validate(&[
                Statement::If(
                    Expression::Boolean(true),
                    vec![assign.clone()],
                    vec![assign]
                ),
                Statement::Print(Expression::Local(0))
            ])
            .is_ok()
        );
        assert!(
            validate(&[Statement::Print(Expression::Bytes(vec![
                0;
                MAX_LITERAL_BYTES
                    + 1
            ]))])
            .is_err()
        );
        let mut deep = Expression::None;
        for _ in 0..130 {
            deep = Expression::Not(Box::new(deep));
        }
        assert!(validate(&[Statement::Print(deep)]).is_err());
        let mut suite = Statement::Print(Expression::None);
        for _ in 0..66 {
            suite = Statement::Group(vec![suite]);
        }
        assert!(validate(&[suite]).is_err());
        assert!(validate(&vec![Statement::Print(Expression::None); MAX_NODES]).is_err());
    }
    #[test]
    fn images_are_deterministic_static_and_keep_literal_data_exact() {
        let program = [
            Statement::Print(Expression::Text("é\0𝄞\\\"".into())),
            Statement::Print(Expression::Bytes(vec![0, 0xff, 39, 34])),
        ];
        let a = emit_elf(&program).unwrap();
        assert_eq!(a, emit_elf(&program).unwrap());
        let text = "é\0𝄞\\\"".as_bytes();
        assert!(a.windows(text.len()).any(|bytes| bytes == text));
        assert_eq!(u16::from_le_bytes(a[56..58].try_into().unwrap()), 2);
        assert_eq!(u32::from_le_bytes(a[68..72].try_into().unwrap()), 5);
        assert_eq!(
            u32::from_le_bytes(a[120..124].try_into().unwrap()),
            0x6474e551
        );
        assert_eq!(u32::from_le_bytes(a[124..128].try_into().unwrap()), 6);
    }
}
