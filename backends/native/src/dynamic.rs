//! Experimental native values. This private layout is not a language ABI.
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
pub const MAX_CHAIN_COMPARISONS: usize = 128;
pub const MAX_DIVISION_LIMB_PRODUCT: usize = 1_000_000;
pub const MAX_FUNCTIONS: usize = 128;
pub const MAX_CALL_DEPTH: usize = 256;
pub const MAX_SOURCE_STACK_BYTES: usize = 2 * 1024 * 1024;
pub const MAX_TUPLE_ELEMENTS: usize = 128;
pub const MAX_LIST_ELEMENTS: usize = 128;
// The shared native array constructor has one defensive capacity check.
const _: () = assert!(MAX_LIST_ELEMENTS == MAX_TUPLE_ELEMENTS);
const HELPER_STACK_RESERVE: i32 = 4096;
const FRAME_BYTES: i32 = 2048;
const CONTEXT_SLOT: i32 = -2032;
const DEPTH_SLOT: i32 = -2040;
const STACK_FLOOR_SLOT: i32 = -2048;

#[derive(Clone, Debug)]
pub struct Program {
    pub body: Vec<Statement>,
    pub functions: Vec<Function>,
}

#[derive(Clone, Debug)]
pub struct Function {
    pub parameters: usize,
    pub body: Vec<Statement>,
}

#[derive(Clone, Debug)]
pub enum Expression {
    Integer(String),
    Text(String),
    Bytes(Vec<u8>),
    Boolean(bool),
    None,
    Local(usize),
    Negate(Box<Self>),
    Positive(Box<Self>),
    Len(Box<Self>),
    RequireInteger(Box<Self>),
    Binary(Binary, Box<Self>, Box<Self>),
    FloorDivide(Box<Self>, Box<Self>),
    Modulo(Box<Self>, Box<Self>),
    Compare(Comparison, Box<Self>, Box<Self>),
    CompareChain(Box<Self>, Vec<(Comparison, Self)>),
    Not(Box<Self>),
    And(Box<Self>, Box<Self>),
    Or(Box<Self>, Box<Self>),
    Call(usize, Vec<Self>),
    Index(Box<Self>, Box<Self>),
    Tuple(Vec<Self>),
    List(Vec<Self>),
}

#[derive(Clone, Debug)]
pub enum Statement {
    Assign(usize, Expression),
    Evaluate(Expression),
    Print(Expression),
    Assert(Expression),
    If(Expression, Vec<Self>, Vec<Self>),
    While(Expression, Vec<Self>),
    Group(Vec<Self>),
    Return(Expression),
    SetIndex {
        sequence: Expression,
        index: Expression,
        value: Expression,
    },
}

struct Validator<'a> {
    nodes: usize,
    literals: usize,
    functions: &'a [Function],
    in_function: bool,
}
impl Validator<'_> {
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
            Expression::Call(index, arguments) => {
                let function = self
                    .functions
                    .get(*index)
                    .ok_or("dynamic call names an unknown function")?;
                if arguments.len() != function.parameters {
                    return Err("dynamic call requires exact positional arity".into());
                }
                for argument in arguments {
                    self.expression(argument, initialized, depth + 1)?;
                }
                0
            }
            Expression::Tuple(elements) => {
                if elements.len() > MAX_TUPLE_ELEMENTS {
                    return Err("dynamic tuple exceeds 128 elements".into());
                }
                for element in elements {
                    self.expression(element, initialized, depth + 1)?;
                }
                0
            }
            Expression::List(elements) => {
                if elements.len() > MAX_LIST_ELEMENTS {
                    return Err("dynamic list exceeds 128 elements".into());
                }
                for element in elements {
                    self.expression(element, initialized, depth + 1)?;
                }
                0
            }
            Expression::Negate(value)
            | Expression::Not(value)
            | Expression::Positive(value)
            | Expression::Len(value)
            | Expression::RequireInteger(value) => {
                self.expression(value, initialized, depth + 1)?;
                0
            }
            Expression::CompareChain(first, rest) => {
                if rest.is_empty() || rest.len() > MAX_CHAIN_COMPARISONS {
                    return Err("dynamic comparison chain requires 1..128 comparisons".into());
                }
                self.expression(first, initialized, depth + 1)?;
                for (index, (_, value)) in rest.iter().enumerate() {
                    // The chain node accounts for its first comparison. Each
                    // additional native comparison also consumes the global
                    // operation budget, as a standalone Compare would.
                    if index != 0 {
                        self.account()?;
                    }
                    self.expression(value, initialized, depth + 1)?;
                }
                0
            }
            Expression::Binary(_, left, right)
            | Expression::FloorDivide(left, right)
            | Expression::Modulo(left, right)
            | Expression::Index(left, right)
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
    ) -> Result<bool, String> {
        if depth > 64 {
            return Err("dynamic suite nesting exceeds 64".into());
        }
        let mut falls_through = true;
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
                Statement::SetIndex {
                    sequence,
                    index,
                    value,
                } => {
                    self.expression(value, initialized, 0)?;
                    self.expression(sequence, initialized, 0)?;
                    self.expression(index, initialized, 0)?;
                }
                Statement::Print(value) | Statement::Assert(value) | Statement::Evaluate(value) => {
                    self.expression(value, initialized, 0)?
                }
                Statement::Return(value) => {
                    if !self.in_function {
                        return Err("dynamic return is outside a function".into());
                    }
                    self.expression(value, initialized, 0)?;
                    falls_through = false;
                }
                Statement::Group(body) => {
                    falls_through &= self.statements(body, initialized, depth + 1)?;
                }
                Statement::If(condition, yes, no) => {
                    self.expression(condition, initialized, 0)?;
                    let mut a = *initialized;
                    let mut b = *initialized;
                    let a_live = self.statements(yes, &mut a, depth + 1)?;
                    let b_live = self.statements(no, &mut b, depth + 1)?;
                    for index in 0..MAX_LOCALS {
                        initialized[index] = match (a_live, b_live) {
                            (true, true) | (false, false) => a[index] && b[index],
                            (true, false) => a[index],
                            (false, true) => b[index],
                        };
                    }
                    falls_through &= a_live || b_live;
                }
                Statement::While(condition, body) => {
                    self.expression(condition, initialized, 0)?;
                    let mut body_state = *initialized;
                    self.statements(body, &mut body_state, depth + 1)?;
                }
            }
        }
        Ok(falls_through)
    }
}

pub fn validate(statements: &[Statement]) -> Result<(), String> {
    validate_parts(statements, &[])
}

pub fn validate_program(program: &Program) -> Result<(), String> {
    validate_parts(&program.body, &program.functions)
}

fn validate_parts(statements: &[Statement], functions: &[Function]) -> Result<(), String> {
    if statements.is_empty() {
        return Err("dynamic IR has no executable statements".into());
    }
    if functions.len() > MAX_FUNCTIONS {
        return Err("dynamic program exceeds 128 functions".into());
    }
    for function in functions {
        if function.parameters > MAX_LOCALS {
            return Err("dynamic function exceeds 128 parameters".into());
        }
    }
    let mut validator = Validator {
        nodes: 0,
        literals: 0,
        functions,
        in_function: false,
    };
    validator.statements(statements, &mut [false; MAX_LOCALS], 0)?;
    validator.in_function = true;
    for function in functions {
        validator.account()?;
        let mut initialized = [false; MAX_LOCALS];
        initialized[..function.parameters].fill(true);
        validator.statements(&function.body, &mut initialized, 0)?;
    }
    Ok(())
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
    functions: Vec<usize>,
    return_label: Option<usize>,
    depth_error: usize,
    stack_error: usize,
}
impl Emitter {
    fn push_value(&mut self, register: super::hosted::x64::R) {
        // Only scratch rcx/rdx are clobbered. Leave bounded space for runtime
        // helper calls even at the source temporary stack limit.
        self.code.load(Cx, Bp, CONTEXT_SLOT);
        self.code.load(Dx, Cx, -8);
        self.code.mov(Cx, Sp);
        self.code.immediate(5, Cx, 8 + HELPER_STACK_RESERVE);
        self.code.cmp(Cx, Dx);
        self.code.j(0x82, self.stack_error);
        self.code.push(register);
    }
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
            Expression::Call(index, arguments) => {
                // Pending arguments stay on the caller's stack across other
                // calls; runtime helpers may clobber every scratch register.
                for argument in arguments {
                    self.expression(argument)?;
                    self.push_value(Ax);
                }
                self.code.load(Ax, Bp, CONTEXT_SLOT);
                self.push_value(Ax);
                self.code.call(self.functions[*index]);
                self.code.immediate(0, Sp, 8 * (arguments.len() as i32 + 1));
            }
            Expression::Tuple(elements) | Expression::List(elements) => {
                for element in elements {
                    self.expression(element)?;
                    self.push_value(Ax);
                }
                self.code.mov(Di, Sp);
                self.code.imm(Si, elements.len() as i64);
                self.code
                    .call(if matches!(expression, Expression::List(_)) {
                        self.runtime.list
                    } else {
                        self.runtime.tuple
                    });
                self.code.immediate(0, Sp, 8 * elements.len() as i32);
            }
            Expression::Negate(value) => {
                self.expression(value)?;
                self.code.call(self.runtime.negate);
            }
            Expression::Positive(value)
            | Expression::Len(value)
            | Expression::RequireInteger(value) => {
                self.expression(value)?;
                self.code.call(match expression {
                    Expression::Positive(_) => self.runtime.positive,
                    Expression::Len(_) => self.runtime.len,
                    _ => self.runtime.require_integer,
                });
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
            Expression::FloorDivide(left, right) | Expression::Modulo(left, right) => {
                self.operands(left, right)?;
                self.code
                    .call(if matches!(expression, Expression::FloorDivide(..)) {
                        self.runtime.floor_divide
                    } else {
                        self.runtime.modulo
                    });
            }
            Expression::Index(value, index) => {
                self.operands(value, index)?;
                self.code.call(self.runtime.index);
            }
            Expression::Compare(comparison, left, right) => {
                self.operands(left, right)?;
                let condition = self.comparison_flags(*comparison);
                self.boolean(condition);
            }
            Expression::CompareChain(first, rest) => {
                let false_ = self.code.label();
                let end = self.code.label();
                self.expression(first)?;
                self.push_value(Ax);
                for (comparison, right) in rest {
                    self.expression(right)?;
                    self.code.mov(Si, Ax);
                    self.code.pop(Di);
                    // The exact RHS descriptor becomes the next LHS; evaluating
                    // another expression or comparison may clobber all scratch registers.
                    self.push_value(Si);
                    let condition = self.comparison_flags(*comparison);
                    self.code.j(condition ^ 1, false_);
                }
                self.code.pop(Ax);
                self.code.lea(Ax, self.runtime.true_value);
                self.code.jump(end);
                self.code.bind(false_);
                self.code.pop(Ax);
                self.code.lea(Ax, self.runtime.false_value);
                self.code.bind(end);
            }
            Expression::And(left, right) | Expression::Or(left, right) => {
                self.expression(left)?;
                self.push_value(Ax);
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
    fn comparison_flags(&mut self, comparison: Comparison) -> u8 {
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
        match comparison {
            Comparison::Equal => 0x84,
            Comparison::NotEqual => 0x85,
            Comparison::Less => 0x8c,
            Comparison::LessEqual => 0x8e,
            Comparison::Greater => 0x8f,
            Comparison::GreaterEqual => 0x8d,
        }
    }
    fn sequence(&mut self, tag: u64, value: &[u8]) {
        let label = self.code.label();
        self.literals
            .push(Literal::Sequence(label, tag, value.to_vec()));
        self.code.lea(Ax, label);
    }
    fn operands(&mut self, left: &Expression, right: &Expression) -> Result<(), String> {
        self.expression(left)?;
        self.push_value(Ax);
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
                Statement::SetIndex {
                    sequence,
                    index,
                    value,
                } => {
                    self.expression(value)?;
                    self.push_value(Ax);
                    self.expression(sequence)?;
                    self.push_value(Ax);
                    self.expression(index)?;
                    self.code.mov(Si, Ax);
                    self.code.pop(Di);
                    self.code.pop(Dx);
                    self.code.call(self.runtime.set_index);
                }
                Statement::Evaluate(value) => self.expression(value)?,
                Statement::Print(value) => {
                    self.expression(value)?;
                    self.code.call(self.runtime.print);
                }
                Statement::Assert(value) => self.condition_false(value, self.integers.assertion)?,
                Statement::Return(value) => {
                    self.expression(value)?;
                    self.code
                        .jump(self.return_label.ok_or("return outside native function")?);
                }
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

    fn function(&mut self, index: usize, function: &Function) -> Result<(), String> {
        self.code.bind(self.functions[index]);
        // Check before reserving a frame. The hidden pointer always refers to
        // the main frame's counter, never to a scratch register or code page.
        self.code.load(Cx, Sp, 8);
        self.code.load(Dx, Cx, 0);
        self.code.immediate(7, Dx, MAX_CALL_DEPTH as i32);
        self.code.j(0x83, self.depth_error);
        self.code.load(R8, Cx, -8);
        self.code.mov(Ax, Sp);
        self.code
            .immediate(5, Ax, FRAME_BYTES + 8 + HELPER_STACK_RESERVE);
        self.code.cmp(Ax, R8);
        self.code.j(0x82, self.stack_error);
        self.code.step(Dx, false);
        self.code.store(Cx, 0, Dx);
        self.code.push(Bp);
        self.code.mov(Bp, Sp);
        self.code.immediate(5, Sp, FRAME_BYTES);
        self.code.store(Bp, CONTEXT_SLOT, Cx);
        for parameter in 0..function.parameters {
            self.code.load(
                Ax,
                Bp,
                24 + 8 * (function.parameters - parameter - 1) as i32,
            );
            self.code.store(Bp, -8 * (parameter as i32 + 1), Ax);
        }
        let end = self.code.label();
        self.return_label = Some(end);
        self.statements(&function.body)?;
        self.code.lea(Ax, self.runtime.none_value);
        self.code.bind(end);
        self.code.load(Cx, Bp, CONTEXT_SLOT);
        self.code.load(Dx, Cx, 0);
        self.code.step(Dx, true);
        self.code.store(Cx, 0, Dx);
        self.code.mov(Sp, Bp);
        self.code.pop(Bp);
        self.code.ret();
        self.return_label = None;
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
    emit_parts(statements, &[])
}

pub fn emit_program(program: &Program) -> Result<Vec<u8>, String> {
    emit_parts(&program.body, &program.functions)
}

fn emit_parts(statements: &[Statement], functions: &[Function]) -> Result<Vec<u8>, String> {
    validate_parts(statements, functions)?;
    let mut code = Code::new();
    let integers = runtime::Runtime::new(&mut code);
    let runtime = routines::Runtime::new(&mut code);
    let labels = functions.iter().map(|_| code.label()).collect();
    let depth_error = code.label();
    let stack_error = code.label();
    let mut emitter = Emitter {
        code,
        integers,
        runtime,
        literals: Vec::new(),
        functions: labels,
        return_label: None,
        depth_error,
        stack_error,
    };
    emitter.integers.start(&mut emitter.code);
    emitter.code.zero(Ax);
    emitter.code.store(Bp, DEPTH_SLOT, Ax);
    emitter.code.mov(Ax, Bp);
    emitter.code.immediate(5, Ax, -DEPTH_SLOT);
    emitter.code.store(Bp, CONTEXT_SLOT, Ax);
    emitter.code.mov(Ax, Sp);
    emitter.code.immediate(5, Ax, MAX_SOURCE_STACK_BYTES as i32);
    emitter.code.store(Bp, STACK_FLOOR_SLOT, Ax);
    emitter.statements(statements)?;
    emitter.code.exit(0);
    for (index, function) in functions.iter().enumerate() {
        emitter.function(index, function)?;
    }
    for (label, bytes) in [
        (
            depth_error,
            b"NJA203: native user-call depth limit exceeded\n".as_slice(),
        ),
        (
            stack_error,
            b"NJA203: native source stack limit exceeded\n".as_slice(),
        ),
    ] {
        emitter.code.bind(label);
        let message = emitter.code.label();
        emitter.code.imm(Ax, 1);
        emitter.code.imm(Di, 2);
        emitter.code.lea(Si, message);
        emitter.code.imm(Dx, bytes.len() as i64);
        emitter.code.syscall();
        emitter.code.exit(103);
        emitter.code.bind(message);
        emitter.code.a.bytes(bytes);
    }
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
    emitter.code.bind(emitter.runtime.sequence_data_end);
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
    #[test]
    fn comparison_chains_validate_every_operand_and_enforce_all_limits() {
        let value = Expression::Boolean(false);
        assert!(
            validate(&[Statement::Print(Expression::CompareChain(
                Box::new(value.clone()),
                vec![]
            ))])
            .is_err()
        );
        let chain = Expression::CompareChain(
            Box::new(value.clone()),
            vec![(Comparison::Equal, value.clone()); MAX_CHAIN_COMPARISONS],
        );
        assert!(validate(&[Statement::Print(chain.clone())]).is_ok());
        assert!(
            validate(&[Statement::Print(Expression::CompareChain(
                Box::new(value.clone()),
                vec![(Comparison::Equal, value.clone()); MAX_CHAIN_COMPARISONS + 1]
            ))])
            .is_err()
        );
        assert!(validate(&vec![Statement::Print(chain); 80]).is_err());
        let two = Expression::CompareChain(
            Box::new(value.clone()),
            vec![(Comparison::Equal, value.clone()); 2],
        );
        assert!(validate(&vec![Statement::Print(two); 1667]).is_err());
        let skipped = Expression::CompareChain(
            Box::new(value.clone()),
            vec![
                (Comparison::Equal, Expression::Boolean(true)),
                (Comparison::Equal, Expression::Local(0)),
            ],
        );
        assert!(validate(&[Statement::Print(skipped)]).is_err());
        let skipped = Expression::CompareChain(
            Box::new(value),
            vec![
                (Comparison::Equal, Expression::Boolean(true)),
                (
                    Comparison::Equal,
                    Expression::Text("x".repeat(MAX_LITERAL_BYTES + 1)),
                ),
            ],
        );
        assert!(validate(&[Statement::Print(skipped)]).is_err());
    }
    #[test]
    fn new_unary_expressions_share_depth_node_and_initialization_accounting() {
        for constructor in [
            Expression::Positive,
            Expression::Len,
            Expression::RequireInteger,
        ] {
            assert!(
                validate(&[Statement::Print(constructor(Box::new(Expression::Local(
                    0
                ))))])
                .is_err()
            );
            let mut expression = Expression::Integer("1".into());
            for _ in 0..130 {
                expression = constructor(Box::new(expression));
            }
            assert!(validate(&[Statement::Print(expression)]).is_err());
            assert!(
                validate(&vec![
                    Statement::Print(constructor(Box::new(
                        Expression::Integer("1".into())
                    )));
                    4000
                ])
                .is_err()
            );
        }
    }
    #[test]
    fn division_expressions_preserve_both_operand_validation_and_budgets() {
        for constructor in [Expression::FloorDivide, Expression::Modulo] {
            assert!(
                validate(&[Statement::Print(constructor(
                    Box::new(Expression::Integer("1".into())),
                    Box::new(Expression::Local(0))
                ))])
                .is_err()
            );
            let mut expression = Expression::Integer("1".into());
            for _ in 0..130 {
                expression = constructor(
                    Box::new(expression),
                    Box::new(Expression::Integer("1".into())),
                );
            }
            assert!(validate(&[Statement::Print(expression)]).is_err());
            assert!(
                validate(&vec![
                    Statement::Print(constructor(
                        Box::new(Expression::Integer("1".into())),
                        Box::new(Expression::Integer("1".into()))
                    ));
                    3000
                ])
                .is_err()
            );
        }
    }
}
