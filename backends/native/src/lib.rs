//! Experimental independent Linux x86-64 code generation for explicit checked i64.
//! This is a seed spike, not the complete NAJA backend or hosted integer runtime.

pub const MAX_LOCALS: usize = 128;
pub mod hosted;
const BASE: u64 = 0x400000;
const HEADER_SIZE: usize = 0x1000;

#[derive(Clone, Debug)]
pub enum Expression {
    Integer(i64),
    Local(usize),
    Negate(Box<Expression>),
    Binary(Binary, Box<Expression>, Box<Expression>),
}

#[derive(Clone, Copy, Debug)]
pub enum Binary {
    Add,
    Subtract,
    Multiply,
}

#[derive(Clone, Copy, Debug)]
pub enum Comparison {
    Equal,
    NotEqual,
    Less,
    LessEqual,
    Greater,
    GreaterEqual,
}

#[derive(Clone, Debug)]
pub struct Condition {
    pub left: Expression,
    pub comparison: Comparison,
    pub right: Expression,
}

#[derive(Clone, Debug)]
pub enum Statement {
    /// Transparent source grouping; emits only its body in the same local frame.
    Group(Vec<Statement>),
    Assert(Condition),
    Assign(usize, Expression),
    Print(Expression),
    If(Condition, Vec<Statement>, Vec<Statement>),
    While(Condition, Vec<Statement>),
}

#[derive(Default)]
struct Assembler {
    code: Vec<u8>,
    labels: Vec<Option<usize>>,
    patches: Vec<(usize, usize)>,
}

impl Assembler {
    fn bytes(&mut self, value: &[u8]) {
        self.code.extend_from_slice(value);
    }
    fn label(&mut self) -> usize {
        self.labels.push(None);
        self.labels.len() - 1
    }
    fn bind(&mut self, label: usize) {
        self.labels[label] = Some(self.code.len());
    }
    fn branch(&mut self, opcode: &[u8], label: usize) {
        self.bytes(opcode);
        self.patches.push((self.code.len(), label));
        self.bytes(&[0; 4]);
    }
    fn finish(mut self) -> Result<Vec<u8>, String> {
        for (offset, label) in self.patches {
            let target = self.labels[label].ok_or("unbound native label")?;
            let displacement = i32::try_from(target as i64 - (offset + 4) as i64)
                .map_err(|_| "native branch exceeds rel32 range")?;
            self.code[offset..offset + 4].copy_from_slice(&displacement.to_le_bytes());
        }
        Ok(self.code)
    }
}

struct Generator {
    asm: Assembler,
    overflow: usize,
    io_failure: usize,
    assertion_failure: usize,
    print: usize,
}

impl Generator {
    fn expression(&mut self, expression: &Expression, depth: usize) -> Result<(), String> {
        if depth > 128 {
            return Err("native expression nesting exceeds 128".into());
        }
        match expression {
            Expression::Integer(value) => {
                self.asm.bytes(&[0x48, 0xb8]); // mov rax, imm64
                self.asm.bytes(&value.to_le_bytes());
            }
            Expression::Local(slot) => {
                self.validate_slot(*slot)?;
                self.asm.bytes(&[0x48, 0x8b, 0x85]); // mov rax, [rbp-disp32]
                self.asm.bytes(&(-8 * (*slot as i32 + 1)).to_le_bytes());
            }
            Expression::Negate(value) => {
                self.expression(value, depth + 1)?;
                self.asm.bytes(&[0x48, 0xf7, 0xd8]);
                self.asm.branch(&[0x0f, 0x80], self.overflow);
            }
            Expression::Binary(operator, left, right) => {
                self.expression(left, depth + 1)?;
                self.asm.bytes(&[0x50]); // push rax
                self.expression(right, depth + 1)?;
                self.asm.bytes(&[0x59]); // pop rcx
                match operator {
                    Binary::Add => self.asm.bytes(&[0x48, 0x01, 0xc8]),
                    Binary::Subtract => {
                        self.asm.bytes(&[0x48, 0x29, 0xc1]);
                        self.asm.bytes(&[0x48, 0x89, 0xc8]);
                    }
                    Binary::Multiply => self.asm.bytes(&[0x48, 0x0f, 0xaf, 0xc1]),
                }
                self.asm.branch(&[0x0f, 0x80], self.overflow);
            }
        }
        Ok(())
    }

    fn validate_slot(&self, slot: usize) -> Result<(), String> {
        if slot >= MAX_LOCALS {
            return Err("native local limit exceeded".into());
        }
        Ok(())
    }

    fn condition_false(&mut self, condition: &Condition, target: usize) -> Result<(), String> {
        self.expression(&condition.left, 0)?;
        self.asm.bytes(&[0x50]);
        self.expression(&condition.right, 0)?;
        self.asm.bytes(&[0x59, 0x48, 0x39, 0xc1]); // cmp rcx, rax
        let opposite = match condition.comparison {
            Comparison::Equal => 0x85,
            Comparison::NotEqual => 0x84,
            Comparison::Less => 0x8d,
            Comparison::LessEqual => 0x8f,
            Comparison::Greater => 0x8e,
            Comparison::GreaterEqual => 0x8c,
        };
        self.asm.branch(&[0x0f, opposite], target);
        Ok(())
    }

    fn statements(&mut self, statements: &[Statement], depth: usize) -> Result<(), String> {
        if depth > 64 {
            return Err("native suite nesting exceeds 64".into());
        }
        for statement in statements {
            match statement {
                Statement::Group(body) => self.statements(body, depth + 1)?,
                Statement::Assert(condition) => {
                    self.condition_false(condition, self.assertion_failure)?
                }
                Statement::Assign(slot, expression) => {
                    self.validate_slot(*slot)?;
                    self.expression(expression, 0)?;
                    self.asm.bytes(&[0x48, 0x89, 0x85]);
                    self.asm.bytes(&(-8 * (*slot as i32 + 1)).to_le_bytes());
                }
                Statement::Print(expression) => {
                    self.expression(expression, 0)?;
                    self.asm.branch(&[0xe8], self.print);
                }
                Statement::If(condition, yes, no) => {
                    let otherwise = self.asm.label();
                    let end = self.asm.label();
                    self.condition_false(condition, otherwise)?;
                    self.statements(yes, depth + 1)?;
                    self.asm.branch(&[0xe9], end);
                    self.asm.bind(otherwise);
                    self.statements(no, depth + 1)?;
                    self.asm.bind(end);
                }
                Statement::While(condition, body) => {
                    let start = self.asm.label();
                    let end = self.asm.label();
                    self.asm.bind(start);
                    self.condition_false(condition, end)?;
                    self.statements(body, depth + 1)?;
                    self.asm.branch(&[0xe9], start);
                    self.asm.bind(end);
                }
            }
        }
        Ok(())
    }

    fn exit(&mut self, code: u32) {
        self.asm.bytes(&[0xb8, 60, 0, 0, 0, 0xbf]);
        self.asm.bytes(&code.to_le_bytes());
        self.asm.bytes(&[0x0f, 0x05]);
    }

    fn runtime_error(&mut self, message: &[u8], code: u32) {
        let data = self.asm.label();
        self.asm.bytes(&[0xb8, 1, 0, 0, 0, 0xbf, 2, 0, 0, 0]);
        self.asm.branch(&[0x48, 0x8d, 0x35], data); // lea rsi,[rip+rel32]
        self.asm.bytes(&[0xba]);
        self.asm.bytes(&(message.len() as u32).to_le_bytes());
        self.asm.bytes(&[0x0f, 0x05]); // best-effort stderr diagnostic
        self.exit(code);
        self.asm.bind(data);
        self.asm.bytes(message);
    }

    fn print_routine(&mut self) {
        self.asm.bind(self.print);
        // Print an i64 using unsigned magnitude so i64::MIN is representable.
        // Scratch storage is below rsp; locals use the caller's rbp frame.
        self.asm.bytes(&[0x48, 0x83, 0xec, 0x40]); // sub rsp, 64
        self.asm.bytes(&[0x48, 0x8d, 0x74, 0x24, 0x3f]); // lea rsi,[rsp+63]
        self.asm.bytes(&[0xc6, 0x06, 0x0a]); // newline
        self.asm.bytes(&[0x48, 0x89, 0xc7]); // mov rdi,rax (sign)
        self.asm.bytes(&[0x48, 0x85, 0xc0]);
        let magnitude = self.asm.label();
        self.asm.branch(&[0x0f, 0x89], magnitude); // jns
        self.asm.bytes(&[0x48, 0xf7, 0xd8]); // unsigned abs, no overflow trap here
        self.asm.bind(magnitude);
        self.asm.bytes(&[0x41, 0xb8, 10, 0, 0, 0]); // mov r8d,10
        let digit = self.asm.label();
        self.asm.bind(digit);
        self.asm.bytes(&[0x31, 0xd2, 0x49, 0xf7, 0xf0]); // xor edx,edx; div r8
        self.asm
            .bytes(&[0x80, 0xc2, 0x30, 0x48, 0xff, 0xce, 0x88, 0x16]);
        self.asm.bytes(&[0x48, 0x85, 0xc0]);
        self.asm.branch(&[0x0f, 0x85], digit);
        self.asm.bytes(&[0x48, 0x85, 0xff]);
        let write = self.asm.label();
        self.asm.branch(&[0x0f, 0x89], write);
        self.asm.bytes(&[0x48, 0xff, 0xce, 0xc6, 0x06, 0x2d]);
        self.asm.bind(write);
        self.asm
            .bytes(&[0x48, 0x8d, 0x54, 0x24, 0x40, 0x48, 0x29, 0xf2]); // length
        let retry = self.asm.label();
        self.asm.bind(retry);
        self.asm
            .bytes(&[0xb8, 1, 0, 0, 0, 0xbf, 1, 0, 0, 0, 0x0f, 0x05]);
        self.asm.bytes(&[0x48, 0x83, 0xf8, 0xfc]); // -EINTR
        self.asm.branch(&[0x0f, 0x84], retry);
        self.asm.bytes(&[0x48, 0x85, 0xc0]);
        self.asm.branch(&[0x0f, 0x8e], self.io_failure);
        self.asm.bytes(&[0x48, 0x01, 0xc6, 0x48, 0x29, 0xc2]);
        self.asm.branch(&[0x0f, 0x85], retry); // partial writes
        self.asm.bytes(&[0x48, 0x83, 0xc4, 0x40, 0xc3]);
    }
}

/// Emit an ELF executable without invoking a toolchain, external linker or interpreter.
pub fn emit_elf(statements: &[Statement]) -> Result<Vec<u8>, String> {
    let mut asm = Assembler::default();
    let overflow = asm.label();
    let io_failure = asm.label();
    let assertion_failure = asm.label();
    let print = asm.label();
    let mut generator = Generator {
        asm,
        overflow,
        io_failure,
        assertion_failure,
        print,
    };
    generator
        .asm
        .bytes(&[0x48, 0x89, 0xe5, 0x48, 0x81, 0xec, 0, 8, 0, 0]);
    generator.statements(statements, 0)?;
    generator.exit(0);
    generator.asm.bind(overflow);
    generator.runtime_error(b"NJA201: checked i64 overflow\n", 101);
    generator.asm.bind(io_failure);
    generator.runtime_error(b"NJA202: native stdout write failed\n", 102);
    generator.asm.bind(assertion_failure);
    generator.runtime_error(b"NJA204: assertion failed\n", 104);
    generator.print_routine();
    let code = generator.asm.finish()?;
    elf_image(code)
}

fn elf_image(code: Vec<u8>) -> Result<Vec<u8>, String> {
    let length = HEADER_SIZE
        .checked_add(code.len())
        .ok_or("ELF size overflow")?;
    let mut result = vec![0; HEADER_SIZE];
    result[..16].copy_from_slice(&[0x7f, b'E', b'L', b'F', 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    put16(&mut result, 16, 2); // ET_EXEC
    put16(&mut result, 18, 62); // EM_X86_64
    put32(&mut result, 20, 1);
    put64(&mut result, 24, BASE + HEADER_SIZE as u64);
    put64(&mut result, 32, 64);
    put16(&mut result, 52, 64);
    put16(&mut result, 54, 56);
    put16(&mut result, 56, 2);
    put32(&mut result, 64, 1); // PT_LOAD
    put32(&mut result, 68, 5); // read + execute, never writable
    put64(&mut result, 80, BASE);
    put64(&mut result, 88, BASE);
    put64(&mut result, 96, length as u64);
    put64(&mut result, 104, length as u64);
    put64(&mut result, 112, 0x1000);
    put32(&mut result, 120, 0x6474e551); // PT_GNU_STACK
    put32(&mut result, 124, 6); // read + write, never executable
    put64(&mut result, 168, 16);
    result.extend(code);
    Ok(result)
}

fn put16(bytes: &mut [u8], offset: usize, value: u16) {
    bytes[offset..offset + 2].copy_from_slice(&value.to_le_bytes());
}
fn put32(bytes: &mut [u8], offset: usize, value: u32) {
    bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}
fn put64(bytes: &mut [u8], offset: usize, value: u64) {
    bytes[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deterministic_elf_has_no_interpreter_and_no_writable_executable_segment() {
        let program = [Statement::Print(Expression::Integer(42))];
        let a = emit_elf(&program).unwrap();
        assert_eq!(a, emit_elf(&program).unwrap());
        assert_eq!(&a[..4], b"\x7fELF");
        assert_eq!(u32::from_le_bytes(a[68..72].try_into().unwrap()), 5);
        assert_eq!(
            u32::from_le_bytes(a[120..124].try_into().unwrap()),
            0x6474e551
        );
        assert_eq!(u32::from_le_bytes(a[124..128].try_into().unwrap()), 6);
    }
    #[test]
    fn reject_out_of_frame_access() {
        assert!(emit_elf(&[Statement::Print(Expression::Local(MAX_LOCALS))]).is_err());
        assert!(emit_elf(&[Statement::Assign(MAX_LOCALS, Expression::Integer(0))]).is_err());
    }
}
