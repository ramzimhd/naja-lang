//! Source-described x86-64 arithmetic routines, emitted directly into each ELF.
//! Objects: sign:i64, length:u64, then little-endian u32 base-1e9 limbs.
//! All helpers preserve rbp/rsp and arena bounds r14; only allocate advances r15.
use super::{
    ARENA_BYTES,
    x64::{Code, R::*},
};

pub(super) struct Runtime {
    pub allocate: usize,
    pub negate: usize,
    pub add: usize,
    pub subtract: usize,
    pub multiply: usize,
    pub compare: usize,
    pub print: usize,
    pub zero: usize,
    resource: usize,
    io: usize,
    clone_sign: usize,
    mag_add: usize,
    mag_sub: usize,
    mag_compare: usize,
    normalize: usize,
}
impl Runtime {
    pub fn new(c: &mut Code) -> Self {
        Self {
            allocate: c.label(),
            negate: c.label(),
            add: c.label(),
            subtract: c.label(),
            multiply: c.label(),
            compare: c.label(),
            print: c.label(),
            zero: c.label(),
            resource: c.label(),
            io: c.label(),
            clone_sign: c.label(),
            mag_add: c.label(),
            mag_sub: c.label(),
            mag_compare: c.label(),
            normalize: c.label(),
        }
    }
    pub fn start(&self, c: &mut Code) {
        c.mov(Bp, Sp);
        c.immediate(5, Sp, 2048);
        // mmap(NULL, 64 MiB, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0)
        c.imm(Ax, 9);
        c.zero(Di);
        c.imm(Si, ARENA_BYTES as i64);
        c.imm(Dx, 3);
        c.imm(R10, 0x22);
        c.imm(R8, -1);
        c.zero(R9);
        c.syscall();
        c.immediate(7, Ax, 0);
        c.j(0x8c, self.resource);
        c.mov(R15, Ax);
        c.mov(R14, Ax);
        c.immediate(0, R14, ARENA_BYTES as i32);
    }
    fn return_zero(&self, c: &mut Code) {
        c.lea(Ax, self.zero);
        c.ret();
    }
    fn error(&self, c: &mut Code, label: usize, message: &[u8], status: i64) {
        c.bind(label);
        let data = c.label();
        c.imm(Ax, 1);
        c.imm(Di, 2);
        c.lea(Si, data);
        c.imm(Dx, message.len() as i64);
        c.syscall();
        c.exit(status);
        c.bind(data);
        c.a.bytes(message);
    }
    pub fn emit(&self, c: &mut Code) {
        self.allocator(c);
        self.clone_value(c);
        self.signed_add(c);
        self.magnitude_add(c);
        self.magnitude_sub(c);
        self.product(c);
        self.comparison(c);
        self.magnitude_comparison(c);
        self.normalization(c);
        self.output(c);
        self.error(
            c,
            self.resource,
            b"NJA203: hosted integer arena exhausted\n",
            103,
        );
        self.error(c, self.io, b"NJA202: native stdout write failed\n", 102);
        c.align();
        c.bind(self.zero);
        c.a.bytes(&[0; 16]);
    }
    fn allocator(&self, c: &mut Code) {
        // Input byte size rax; output old cursor rax. Fresh pages are anonymous,
        // but arithmetic routines initialize their own result limbs explicitly.
        c.bind(self.allocate);
        c.immediate(0, Ax, 7);
        c.j(0x82, self.resource);
        c.immediate(4, Ax, -8);
        c.mov(R10, R15);
        c.add(R10, Ax);
        c.j(0x82, self.resource);
        c.cmp(R10, R14);
        c.j(0x87, self.resource);
        c.mov(Ax, R15);
        c.mov(R15, R10);
        c.ret();
    }
    fn clone_value(&self, c: &mut Code) {
        c.bind(self.negate);
        c.mov(Di, Ax);
        c.load(R8, Di, 0);
        c.neg(R8);
        c.jump(self.clone_sign);
        c.bind(self.clone_sign);
        let nonzero = c.label();
        c.immediate(7, R8, 0);
        c.j(0x85, nonzero);
        self.return_zero(c);
        c.bind(nonzero);
        c.mov(R12, Di);
        c.mov(R13, R8);
        c.load(Dx, R12, 8);
        c.mov(Ax, Dx);
        c.shift_left(Ax, 2);
        c.immediate(0, Ax, 16);
        c.call(self.allocate);
        c.mov(Bx, Ax);
        c.store(Bx, 0, R13);
        c.store(Bx, 8, Dx);
        c.zero(Cx);
        let loop_ = c.label();
        let done = c.label();
        c.bind(loop_);
        c.cmp(Cx, Dx);
        c.j(0x83, done);
        c.get(R9, R12, Cx);
        c.put(Bx, Cx, R9);
        c.step(Cx, false);
        c.jump(loop_);
        c.bind(done);
        c.mov(Ax, Bx);
        c.ret();
    }
    fn signed_add(&self, c: &mut Code) {
        let core = c.label();
        c.bind(self.add);
        c.imm(Dx, 1);
        c.jump(core);
        c.bind(self.subtract);
        c.imm(Dx, -1);
        c.bind(core);
        c.mov(R12, Di);
        c.mov(R13, Si);
        c.load(R8, R12, 0);
        c.load(R9, R13, 0);
        c.mul(R9, Dx);
        let lhs_nonzero = c.label();
        let rhs_nonzero = c.label();
        c.immediate(7, R9, 0);
        c.j(0x85, rhs_nonzero);
        c.mov(Ax, R12);
        c.ret();
        c.bind(rhs_nonzero);
        c.immediate(7, R8, 0);
        c.j(0x85, lhs_nonzero);
        c.mov(Di, R13);
        c.mov(R8, R9);
        c.jump(self.clone_sign);
        c.bind(lhs_nonzero);
        c.cmp(R8, R9);
        c.j(0x84, self.mag_add);
        c.push(R8);
        c.push(R9);
        c.call(self.mag_compare);
        c.pop(R9);
        c.pop(R8);
        let unequal = c.label();
        let positive = c.label();
        c.immediate(7, Ax, 0);
        c.j(0x85, unequal);
        self.return_zero(c);
        c.bind(unequal);
        c.j(0x8f, positive);
        c.mov(Ax, R12);
        c.mov(R12, R13);
        c.mov(R13, Ax);
        c.mov(R8, R9);
        c.bind(positive);
        c.jump(self.mag_sub);
    }
    fn magnitude_add(&self, c: &mut Code) {
        c.bind(self.mag_add);
        c.mov(Di, R8);
        c.load(R8, R12, 8);
        c.load(R9, R13, 8);
        c.mov(Dx, R8);
        let maximum = c.label();
        c.cmp(Dx, R9);
        c.j(0x83, maximum);
        c.mov(Dx, R9);
        c.bind(maximum);
        c.mov(Ax, Dx);
        c.step(Ax, false);
        c.shift_left(Ax, 2);
        c.immediate(0, Ax, 16);
        c.call(self.allocate);
        c.mov(Bx, Ax);
        c.store(Bx, 0, Di);
        c.zero(Cx);
        c.zero(R11);
        let loop_ = c.label();
        let done = c.label();
        let no_a = c.label();
        let no_b = c.label();
        let small = c.label();
        let store = c.label();
        c.bind(loop_);
        c.cmp(Cx, Dx);
        c.j(0x83, done);
        c.mov(Ax, R11);
        c.zero(R11);
        c.cmp(Cx, R8);
        c.j(0x83, no_a);
        c.get(Di, R12, Cx);
        c.add(Ax, Di);
        c.bind(no_a);
        c.cmp(Cx, R9);
        c.j(0x83, no_b);
        c.get(Di, R13, Cx);
        c.add(Ax, Di);
        c.bind(no_b);
        c.immediate(7, Ax, 1_000_000_000);
        c.j(0x82, small);
        c.immediate(5, Ax, 1_000_000_000);
        c.imm(R11, 1);
        c.jump(store);
        c.bind(small);
        c.bind(store);
        c.put(Bx, Cx, Ax);
        c.step(Cx, false);
        c.jump(loop_);
        c.bind(done);
        let no_carry = c.label();
        c.immediate(7, R11, 0);
        c.j(0x84, no_carry);
        c.put(Bx, Cx, R11);
        c.step(Dx, false);
        c.bind(no_carry);
        c.store(Bx, 8, Dx);
        c.mov(Ax, Bx);
        c.ret();
    }
    fn magnitude_sub(&self, c: &mut Code) {
        c.bind(self.mag_sub);
        c.mov(Di, R8);
        c.load(Dx, R12, 8);
        c.load(R9, R13, 8);
        c.mov(Ax, Dx);
        c.shift_left(Ax, 2);
        c.immediate(0, Ax, 16);
        c.call(self.allocate);
        c.mov(Bx, Ax);
        c.store(Bx, 0, Di);
        c.store(Bx, 8, Dx);
        c.zero(Cx);
        c.zero(R11);
        let loop_ = c.label();
        let done = c.label();
        let no_b = c.label();
        let enough = c.label();
        let store = c.label();
        c.bind(loop_);
        c.cmp(Cx, Dx);
        c.j(0x83, done);
        c.get(Ax, R12, Cx);
        c.mov(Di, R11);
        c.cmp(Cx, R9);
        c.j(0x83, no_b);
        c.get(R10, R13, Cx);
        c.add(Di, R10);
        c.bind(no_b);
        c.zero(R11);
        c.cmp(Ax, Di);
        c.j(0x83, enough);
        c.immediate(0, Ax, 1_000_000_000);
        c.imm(R11, 1);
        c.jump(store);
        c.bind(enough);
        c.bind(store);
        c.sub(Ax, Di);
        c.put(Bx, Cx, Ax);
        c.step(Cx, false);
        c.jump(loop_);
        c.bind(done);
        c.jump(self.normalize);
    }
    fn product(&self, c: &mut Code) {
        c.bind(self.multiply);
        c.mov(R12, Di);
        c.mov(R13, Si);
        c.load(R8, R12, 0);
        c.load(R9, R13, 0);
        c.mul(R8, R9);
        let nonzero = c.label();
        c.immediate(7, R8, 0);
        c.j(0x85, nonzero);
        self.return_zero(c);
        c.bind(nonzero);
        c.mov(Di, R8);
        c.load(R8, R12, 8);
        c.load(R9, R13, 8);
        c.mov(Dx, R8);
        c.add(Dx, R9);
        c.mov(Ax, Dx);
        c.shift_left(Ax, 2);
        c.immediate(0, Ax, 16);
        c.call(self.allocate);
        c.mov(Bx, Ax);
        c.store(Bx, 0, Di);
        c.store(Bx, 8, Dx);
        c.zero(Cx);
        c.zero(Ax);
        let clear = c.label();
        let cleared = c.label();
        c.bind(clear);
        c.cmp(Cx, Dx);
        c.j(0x83, cleared);
        c.put(Bx, Cx, Ax);
        c.step(Cx, false);
        c.jump(clear);
        c.bind(cleared);
        c.zero(Cx);
        let outer = c.label();
        let done = c.label();
        let inner = c.label();
        let row_done = c.label();
        c.bind(outer);
        c.cmp(Cx, R8);
        c.j(0x83, done);
        c.zero(R10);
        c.zero(R11);
        c.bind(inner);
        c.cmp(R10, R9);
        c.j(0x83, row_done);
        c.get(Ax, R12, Cx);
        c.get(Di, R13, R10);
        c.mul(Ax, Di);
        c.add(Ax, R11);
        c.mov(Si, Cx);
        c.add(Si, R10);
        c.get(Di, Bx, Si);
        c.add(Ax, Di);
        c.zero(Dx);
        c.imm(Di, 1_000_000_000);
        c.div(Di);
        c.mov(R11, Ax);
        c.put(Bx, Si, Dx);
        c.step(R10, false);
        c.jump(inner);
        c.bind(row_done);
        c.mov(Si, Cx);
        c.add(Si, R9);
        c.put(Bx, Si, R11);
        c.step(Cx, false);
        c.jump(outer);
        c.bind(done);
        c.jump(self.normalize);
    }
    fn comparison(&self, c: &mut Code) {
        c.bind(self.compare);
        c.load(R8, Di, 0);
        c.load(R9, Si, 0);
        let positive = c.label();
        let negative = c.label();
        let equal_sign = c.label();
        c.cmp(R8, R9);
        c.j(0x8f, positive);
        c.j(0x8c, negative);
        c.immediate(7, R8, 0);
        c.j(0x85, equal_sign);
        c.zero(Ax);
        c.ret();
        c.bind(equal_sign);
        c.mov(Bx, R8);
        c.call(self.mag_compare);
        let finish = c.label();
        c.immediate(7, Bx, 0);
        c.j(0x8f, finish);
        c.neg(Ax);
        c.bind(finish);
        c.ret();
        c.bind(positive);
        c.imm(Ax, 1);
        c.ret();
        c.bind(negative);
        c.imm(Ax, -1);
        c.ret();
    }
    fn magnitude_comparison(&self, c: &mut Code) {
        c.bind(self.mag_compare);
        c.load(Cx, Di, 8);
        c.load(Dx, Si, 8);
        let positive = c.label();
        let negative = c.label();
        let equal = c.label();
        let loop_ = c.label();
        c.cmp(Cx, Dx);
        c.j(0x87, positive);
        c.j(0x82, negative);
        c.bind(loop_);
        c.immediate(7, Cx, 0);
        c.j(0x84, equal);
        c.step(Cx, true);
        c.get(R8, Di, Cx);
        c.get(R9, Si, Cx);
        c.cmp(R8, R9);
        c.j(0x87, positive);
        c.j(0x82, negative);
        c.jump(loop_);
        c.bind(positive);
        c.imm(Ax, 1);
        c.ret();
        c.bind(negative);
        c.imm(Ax, -1);
        c.ret();
        c.bind(equal);
        c.zero(Ax);
        c.ret();
    }
    fn normalization(&self, c: &mut Code) {
        c.bind(self.normalize);
        c.load(Cx, Bx, 8);
        let loop_ = c.label();
        let nonzero = c.label();
        c.bind(loop_);
        c.immediate(7, Cx, 0);
        c.j(0x85, nonzero);
        self.return_zero(c);
        c.bind(nonzero);
        c.step(Cx, true);
        c.get(R9, Bx, Cx);
        let found = c.label();
        c.immediate(7, R9, 0);
        c.j(0x85, found);
        c.jump(loop_);
        c.bind(found);
        c.step(Cx, false);
        c.store(Bx, 8, Cx);
        c.mov(Ax, Bx);
        c.ret();
    }
    fn output(&self, c: &mut Code) {
        c.bind(self.print);
        c.mov(R12, Ax);
        c.load(Ax, R12, 8);
        c.imm(R8, 9);
        c.mul(Ax, R8);
        c.immediate(0, Ax, 2);
        c.mov(R13, Ax);
        c.call(self.allocate);
        c.mov(Bx, Ax);
        c.add(Bx, R13);
        c.mov(R11, Bx);
        c.step(R11, true);
        c.imm(Dx, 10);
        c.byte(R11, Dx);
        let nonzero = c.label();
        let signed = c.label();
        c.load(R9, R12, 8);
        c.immediate(7, R9, 0);
        c.j(0x85, nonzero);
        c.step(R11, true);
        c.imm(Dx, 48);
        c.byte(R11, Dx);
        c.jump(signed);
        c.bind(nonzero);
        c.zero(Cx);
        c.imm(R8, 10);
        let limb = c.label();
        let digit = c.label();
        let more_limb = c.label();
        let most = c.label();
        c.bind(limb);
        c.get(Ax, R12, Cx);
        c.imm(R10, 9);
        c.bind(digit);
        c.zero(Dx);
        c.div(R8);
        c.immediate(0, Dx, 48);
        c.step(R11, true);
        c.byte(R11, Dx);
        c.load(R9, R12, 8);
        c.step(R9, true);
        c.cmp(Cx, R9);
        c.j(0x84, most);
        c.step(R10, true);
        c.j(0x85, digit);
        c.jump(more_limb);
        c.bind(most);
        c.immediate(7, Ax, 0);
        c.j(0x85, digit);
        c.bind(more_limb);
        c.step(Cx, false);
        c.load(R9, R12, 8);
        c.cmp(Cx, R9);
        c.j(0x82, limb);
        c.bind(signed);
        let write = c.label();
        c.load(Ax, R12, 0);
        c.immediate(7, Ax, 0);
        c.j(0x8d, write);
        c.step(R11, true);
        c.imm(Dx, 45);
        c.byte(R11, Dx);
        c.bind(write);
        c.mov(Si, R11);
        c.mov(Dx, Bx);
        c.sub(Dx, Si);
        let retry = c.label();
        c.bind(retry);
        c.imm(Ax, 1);
        c.imm(Di, 1);
        c.syscall();
        c.immediate(7, Ax, -4);
        c.j(0x84, retry);
        c.immediate(7, Ax, 0);
        c.j(0x8e, self.io);
        c.add(Si, Ax);
        c.sub(Dx, Ax);
        c.j(0x85, retry);
        c.ret();
    }
}
