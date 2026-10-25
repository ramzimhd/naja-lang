//! Small instruction encoder for the hosted runtime's internal calling convention.
use crate::Assembler;

#[derive(Clone, Copy)]
#[repr(u8)]
pub(super) enum R {
    Ax,
    Cx,
    Dx,
    Bx,
    Sp,
    Bp,
    Si,
    Di,
    R8,
    R9,
    R10,
    R11,
    R12,
    R13,
    R14,
    R15,
}
pub(super) struct Code {
    pub a: Assembler,
}
impl Code {
    pub fn new() -> Self {
        Self {
            a: Assembler::default(),
        }
    }
    pub fn label(&mut self) -> usize {
        self.a.label()
    }
    pub fn bind(&mut self, label: usize) {
        self.a.bind(label);
    }
    pub fn jump(&mut self, label: usize) {
        self.a.branch(&[0xe9], label);
    }
    pub fn call(&mut self, label: usize) {
        self.a.branch(&[0xe8], label);
    }
    pub fn j(&mut self, condition: u8, label: usize) {
        self.a.branch(&[0x0f, condition], label);
    }
    pub fn ret(&mut self) {
        self.a.bytes(&[0xc3]);
    }
    pub fn syscall(&mut self) {
        self.a.bytes(&[0x0f, 0x05]);
    }
    fn rex(&mut self, wide: bool, reg: R, index: u8, base: R) {
        self.a.bytes(&[0x40
            | if wide { 8 } else { 0 }
            | (((reg as u8) >> 3) << 2)
            | ((index >> 3) << 1)
            | ((base as u8) >> 3)]);
    }
    pub fn rr(&mut self, opcode: u8, destination: R, source: R) {
        self.rex(true, source, 0, destination);
        self.a.bytes(&[
            opcode,
            0xc0 | (((source as u8) & 7) << 3) | ((destination as u8) & 7),
        ]);
    }
    pub fn mov(&mut self, destination: R, source: R) {
        self.rr(0x89, destination, source);
    }
    pub fn add(&mut self, destination: R, source: R) {
        self.rr(0x01, destination, source);
    }
    pub fn sub(&mut self, destination: R, source: R) {
        self.rr(0x29, destination, source);
    }
    pub fn cmp(&mut self, left: R, right: R) {
        self.rr(0x39, left, right);
    }
    pub fn zero(&mut self, register: R) {
        self.rr(0x31, register, register);
    }
    pub fn imm(&mut self, register: R, value: i64) {
        self.a.bytes(&[
            0x48 | ((register as u8) >> 3),
            0xb8 | ((register as u8) & 7),
        ]);
        self.a.bytes(&value.to_le_bytes());
    }
    pub fn immediate(&mut self, operation: u8, register: R, value: i32) {
        self.rex(true, R::Ax, 0, register);
        self.a
            .bytes(&[0x81, 0xc0 | (operation << 3) | ((register as u8) & 7)]);
        self.a.bytes(&value.to_le_bytes());
    }
    fn memory(&mut self, opcode: u8, wide: bool, reg: R, base: R, offset: i32) {
        self.rex(wide, reg, 0, base);
        self.a
            .bytes(&[opcode, 0x80 | (((reg as u8) & 7) << 3) | ((base as u8) & 7)]);
        if (base as u8) & 7 == 4 {
            self.a.bytes(&[0x24]);
        }
        self.a.bytes(&offset.to_le_bytes());
    }
    pub fn load(&mut self, destination: R, base: R, offset: i32) {
        self.memory(0x8b, true, destination, base, offset);
    }
    pub fn store(&mut self, base: R, offset: i32, source: R) {
        self.memory(0x89, true, source, base, offset);
    }
    pub fn byte(&mut self, base: R, source: R) {
        self.memory(0x88, false, source, base, 0);
    }
    fn limb(&mut self, opcode: u8, reg: R, base: R, index: R) {
        self.rex(false, reg, index as u8, base);
        self.a.bytes(&[
            opcode,
            0x84 | (((reg as u8) & 7) << 3),
            0x80 | (((index as u8) & 7) << 3) | ((base as u8) & 7),
        ]);
        self.a.bytes(&16_i32.to_le_bytes());
    }
    pub fn get(&mut self, destination: R, base: R, index: R) {
        self.limb(0x8b, destination, base, index);
    }
    pub fn put(&mut self, base: R, index: R, source: R) {
        self.limb(0x89, source, base, index);
    }
    pub fn lea(&mut self, destination: R, label: usize) {
        self.a.branch(
            &[
                0x48 | (((destination as u8) >> 3) << 2),
                0x8d,
                0x05 | (((destination as u8) & 7) << 3),
            ],
            label,
        );
    }
    pub fn push(&mut self, register: R) {
        if register as u8 >= 8 {
            self.a.bytes(&[0x41]);
        }
        self.a.bytes(&[0x50 | ((register as u8) & 7)]);
    }
    pub fn pop(&mut self, register: R) {
        if register as u8 >= 8 {
            self.a.bytes(&[0x41]);
        }
        self.a.bytes(&[0x58 | ((register as u8) & 7)]);
    }
    pub fn step(&mut self, register: R, decrement: bool) {
        self.rex(true, R::Ax, 0, register);
        self.a.bytes(&[
            0xff,
            0xc0 | if decrement { 8 } else { 0 } | ((register as u8) & 7),
        ]);
    }
    pub fn neg(&mut self, register: R) {
        self.rex(true, R::Ax, 0, register);
        self.a.bytes(&[0xf7, 0xd8 | ((register as u8) & 7)]);
    }
    pub fn mul(&mut self, destination: R, source: R) {
        self.rex(true, destination, 0, source);
        self.a.bytes(&[
            0x0f,
            0xaf,
            0xc0 | (((destination as u8) & 7) << 3) | ((source as u8) & 7),
        ]);
    }
    pub fn div(&mut self, divisor: R) {
        self.rex(true, R::Ax, 0, divisor);
        self.a.bytes(&[0xf7, 0xf0 | ((divisor as u8) & 7)]);
    }
    pub fn shift_left(&mut self, register: R, count: u8) {
        self.rex(true, R::Ax, 0, register);
        self.a.bytes(&[0xc1, 0xe0 | ((register as u8) & 7), count]);
    }
    pub fn exit(&mut self, status: i64) {
        self.imm(R::Ax, 60);
        self.imm(R::Di, status);
        self.syscall();
    }
    pub fn align(&mut self) {
        while !self.a.code.len().is_multiple_of(8) {
            self.a.bytes(&[0]);
        }
    }
}
