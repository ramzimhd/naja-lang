//! Native tagged-value routines; numeric kernels are shared with hosted integers.
//! Descriptor: tag:u64, data:pointer, byte_length:u64. Tags 0=int,1=text,2=bytes,
//! 3=bool (pointer to integer zero/one),4=None,5=tuple (element count at+16).
//! No user pointer API exists here.
use super::ARENA_BYTES;
use crate::hosted::{
    runtime,
    x64::{Code, R::*},
};
mod division;
mod indexing;
mod tuples;

pub(super) struct Runtime {
    pub add: usize,
    pub subtract: usize,
    pub multiply: usize,
    pub negate: usize,
    pub floor_divide: usize,
    pub modulo: usize,
    pub positive: usize,
    pub len: usize,
    pub require_integer: usize,
    pub index: usize,
    pub sequence_data_end: usize,
    pub tuple: usize,
    tuple_check: usize,
    tuple_resource: usize,
    span_check: usize,
    pub compare: usize,
    pub truth: usize,
    pub print: usize,
    pub type_error: usize,
    pub true_value: usize,
    pub false_value: usize,
    pub none_value: usize,
    check: usize,
    number: usize,
    wrap: usize,
    concat: usize,
    copy: usize,
    write: usize,
    bytes_print: usize,
    true_text: usize,
    false_text: usize,
    none_text: usize,
    newline: usize,
    hex: usize,
    small_integer: usize,
}
impl Runtime {
    pub fn new(c: &mut Code) -> Self {
        Self {
            add: c.label(),
            subtract: c.label(),
            multiply: c.label(),
            negate: c.label(),
            floor_divide: c.label(),
            modulo: c.label(),
            positive: c.label(),
            len: c.label(),
            require_integer: c.label(),
            index: c.label(),
            sequence_data_end: c.label(),
            tuple: c.label(),
            tuple_check: c.label(),
            tuple_resource: c.label(),
            span_check: c.label(),
            compare: c.label(),
            truth: c.label(),
            print: c.label(),
            type_error: c.label(),
            true_value: c.label(),
            false_value: c.label(),
            none_value: c.label(),
            check: c.label(),
            number: c.label(),
            wrap: c.label(),
            concat: c.label(),
            copy: c.label(),
            write: c.label(),
            bytes_print: c.label(),
            true_text: c.label(),
            false_text: c.label(),
            none_text: c.label(),
            newline: c.label(),
            hex: c.label(),
            small_integer: c.label(),
        }
    }
    pub fn emit(&self, c: &mut Code, integers: &runtime::Runtime) {
        self.check(c, integers);
        self.numeric(c, integers);
        self.division(c, integers);
        self.length(c, integers);
        self.tuples(c, integers);
        self.indexing(c, integers);
        self.concatenation(c, integers);
        self.comparison(c, integers);
        self.truthiness(c);
        self.output(c, integers);
        self.bytes_output(c, integers);
        c.bind(self.type_error);
        let message = c.label();
        let diagnostic = b"NJA205: native value type mismatch\n";
        c.imm(Ax, 1);
        c.imm(Di, 2);
        c.lea(Si, message);
        c.imm(Dx, diagnostic.len() as i64);
        c.syscall();
        c.exit(105);
        c.bind(message);
        c.a.bytes(diagnostic);
        c.bind(self.true_text);
        c.a.bytes(b"True\n");
        c.bind(self.false_text);
        c.a.bytes(b"False\n");
        c.bind(self.none_text);
        c.a.bytes(b"None\n");
        c.bind(self.newline);
        c.a.bytes(b"\n");
        c.bind(self.hex);
        c.a.bytes(b"0123456789abcdef");
    }
    fn check(&self, c: &mut Code, integers: &runtime::Runtime) {
        // Every descriptor is constructed internally from validated IR or a
        // checked arena allocation. Guard tags before interpreting payloads.
        c.bind(self.check);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 5);
        c.j(0x87, self.type_error);
        c.j(0x84, self.tuple_check);
        let sequence = c.label();
        let done = c.label();
        c.immediate(7, Dx, 1);
        c.j(0x84, sequence);
        c.immediate(7, Dx, 2);
        c.j(0x85, done);
        c.bind(sequence);
        c.load(R10, Ax, 16);
        c.immediate(7, R10, ARENA_BYTES as i32);
        c.j(0x87, integers.resource);
        c.bind(done);
        c.ret();
        c.bind(self.number);
        c.call(self.require_integer);
        c.load(Ax, Ax, 8);
        c.ret();
        c.bind(self.require_integer);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 5);
        c.j(0x84, self.type_error);
        c.call(self.check);
        c.load(Dx, Ax, 0);
        let number = c.label();
        c.immediate(7, Dx, 0);
        c.j(0x84, number);
        c.immediate(7, Dx, 3);
        c.j(0x85, self.type_error);
        c.bind(number);
        c.ret();
    }
    fn numeric(&self, c: &mut Code, integers: &runtime::Runtime) {
        c.bind(self.wrap);
        c.push(Ax);
        c.imm(Ax, 24);
        c.call(integers.allocate);
        c.pop(Dx);
        c.zero(Cx);
        c.store(Ax, 0, Cx);
        c.store(Ax, 8, Dx);
        c.store(Ax, 16, Cx);
        c.ret();
        c.bind(self.negate);
        c.call(self.number);
        c.call(integers.negate);
        c.jump(self.wrap);
        c.bind(self.positive);
        c.call(self.require_integer);
        c.load(Dx, Ax, 0);
        let positive_int = c.label();
        c.immediate(7, Dx, 0);
        c.j(0x84, positive_int);
        c.load(Ax, Ax, 8);
        c.jump(self.wrap);
        c.bind(positive_int);
        c.ret();
        c.bind(self.add);
        c.load(Dx, Di, 0);
        c.immediate(7, Dx, 5);
        c.j(0x84, self.type_error);
        c.load(Dx, Si, 0);
        c.immediate(7, Dx, 5);
        c.j(0x84, self.type_error);
        c.mov(Ax, Di);
        c.call(self.check);
        c.mov(Ax, Si);
        c.call(self.check);
        c.load(R8, Di, 0);
        c.load(R9, Si, 0);
        let numeric = c.label();
        let sequence = c.label();
        c.immediate(7, R8, 0);
        c.j(0x84, numeric);
        c.immediate(7, R8, 3);
        c.j(0x84, numeric);
        c.immediate(7, R8, 1);
        c.j(0x84, sequence);
        c.immediate(7, R8, 2);
        c.j(0x85, self.type_error);
        c.bind(sequence);
        c.cmp(R8, R9);
        c.j(0x85, self.type_error);
        c.jump(self.concat);
        c.bind(numeric);
        self.numeric_pair(c, integers.add);
        c.bind(self.subtract);
        self.numeric_pair(c, integers.subtract);
        c.bind(self.multiply);
        self.numeric_pair(c, integers.multiply);
    }
    fn length(&self, c: &mut Code, integers: &runtime::Runtime) {
        c.bind(self.len);
        c.call(self.check);
        c.load(Dx, Ax, 0);
        let text = c.label();
        c.immediate(7, Dx, 1);
        c.j(0x84, text);
        c.immediate(7, Dx, 2);
        let length = c.label();
        c.j(0x84, length);
        c.immediate(7, Dx, 5);
        c.j(0x85, self.type_error);
        c.bind(length);
        c.load(Ax, Ax, 16);
        c.jump(self.small_integer);
        c.bind(text);
        c.load(R8, Ax, 8);
        c.load(R9, Ax, 16);
        c.zero(R12);
        let loop_ = c.label();
        let next = c.label();
        let done = c.label();
        c.bind(loop_);
        c.immediate(7, R9, 0);
        c.j(0x84, done);
        // Text construction and concatenation preserve valid UTF-8. Count
        // leading bytes, not continuation bytes or grapheme clusters.
        c.load_byte(Dx, R8);
        c.immediate(4, Dx, 0xc0);
        c.immediate(7, Dx, 0x80);
        c.j(0x84, next);
        c.step(R12, false);
        c.bind(next);
        c.step(R8, false);
        c.step(R9, true);
        c.jump(loop_);
        c.bind(done);
        c.mov(Ax, R12);
        c.bind(self.small_integer);
        // Length is bounded by the 64 MiB sequence limit, below one base-1e9
        // limb. The explicit guard prevents a future limit change truncating it.
        c.immediate(7, Ax, 999_999_999);
        c.j(0x87, integers.resource);
        let zero = c.label();
        c.immediate(7, Ax, 0);
        c.j(0x84, zero);
        c.mov(R12, Ax);
        c.imm(Ax, 24);
        c.call(integers.allocate);
        c.imm(Dx, 1);
        c.store(Ax, 0, Dx);
        c.store(Ax, 8, Dx);
        c.zero(Cx);
        c.put(Ax, Cx, R12);
        c.jump(self.wrap);
        c.bind(zero);
        c.lea(Ax, integers.zero);
        c.jump(self.wrap);
    }
    fn numeric_pair(&self, c: &mut Code, operation: usize) {
        c.push(Si);
        c.mov(Ax, Di);
        c.call(self.number);
        c.mov(Di, Ax);
        c.pop(Ax);
        c.push(Di);
        c.call(self.number);
        c.mov(Si, Ax);
        c.pop(Di);
        c.call(operation);
        c.jump(self.wrap);
    }
    fn concatenation(&self, c: &mut Code, integers: &runtime::Runtime) {
        c.bind(self.concat);
        c.mov(R12, Di);
        c.mov(R13, Si);
        c.load(R11, R12, 16);
        c.load(Dx, R13, 16);
        c.add(R11, Dx);
        c.j(0x82, integers.resource);
        c.mov(Ax, R11);
        c.immediate(0, Ax, 24);
        c.j(0x82, integers.resource);
        c.call(integers.allocate);
        c.mov(Bx, Ax);
        c.load(Dx, R12, 0);
        c.store(Bx, 0, Dx);
        c.store(Bx, 16, R11);
        c.mov(R9, Bx);
        c.immediate(0, R9, 24);
        c.store(Bx, 8, R9);
        c.load(R8, R12, 8);
        c.load(R10, R12, 16);
        c.call(self.copy);
        c.load(R8, R13, 8);
        c.load(R10, R13, 16);
        c.call(self.copy);
        c.mov(Ax, Bx);
        c.ret();
        c.bind(self.copy);
        let done = c.label();
        let loop_ = c.label();
        c.bind(loop_);
        c.immediate(7, R10, 0);
        c.j(0x84, done);
        c.load_byte(Dx, R8);
        c.byte(R9, Dx);
        c.step(R8, false);
        c.step(R9, false);
        c.step(R10, true);
        c.jump(loop_);
        c.bind(done);
        c.ret();
    }
    fn comparison(&self, c: &mut Code, integers: &runtime::Runtime) {
        c.bind(self.compare);
        c.load(Dx, Di, 0);
        c.immediate(7, Dx, 5);
        c.j(0x84, self.type_error);
        c.load(Dx, Si, 0);
        c.immediate(7, Dx, 5);
        c.j(0x84, self.type_error);
        c.mov(Ax, Di);
        c.call(self.check);
        c.mov(Ax, Si);
        c.call(self.check);
        c.load(R8, Di, 0);
        c.load(R9, Si, 0);
        let numeric = c.label();
        let numeric_right = c.label();
        let same = c.label();
        let sequence = c.label();
        let unrelated = c.label();
        c.immediate(7, R8, 0);
        c.j(0x84, numeric);
        c.immediate(7, R8, 3);
        c.j(0x84, numeric);
        c.cmp(R8, R9);
        c.j(0x84, same);
        c.jump(unrelated);
        c.bind(numeric);
        c.immediate(7, R9, 0);
        c.j(0x84, numeric_right);
        c.immediate(7, R9, 3);
        c.j(0x85, unrelated);
        c.bind(numeric_right);
        c.load(Di, Di, 8);
        c.load(Si, Si, 8);
        c.jump(integers.compare);
        c.bind(same);
        c.immediate(7, R8, 4);
        c.j(0x85, sequence);
        c.imm(Ax, 3);
        c.ret();
        c.bind(sequence);
        c.load(R12, Di, 8);
        c.load(R13, Si, 8);
        c.load(Cx, Di, 16);
        c.load(Dx, Si, 16);
        let loop_ = c.label();
        let left_end = c.label();
        let equal = c.label();
        let positive = c.label();
        let negative = c.label();
        c.bind(loop_);
        c.immediate(7, Cx, 0);
        c.j(0x84, left_end);
        c.immediate(7, Dx, 0);
        c.j(0x84, positive);
        c.load_byte(Ax, R12);
        c.load_byte(R9, R13);
        c.cmp(Ax, R9);
        c.j(0x87, positive);
        c.j(0x82, negative);
        c.step(R12, false);
        c.step(R13, false);
        c.step(Cx, true);
        c.step(Dx, true);
        c.jump(loop_);
        c.bind(left_end);
        c.immediate(7, Dx, 0);
        c.j(0x84, equal);
        c.jump(negative);
        c.bind(equal);
        c.zero(Ax);
        c.ret();
        c.bind(positive);
        c.imm(Ax, 1);
        c.ret();
        c.bind(negative);
        c.imm(Ax, -1);
        c.ret();
        c.bind(unrelated);
        c.imm(Ax, 2);
        c.ret();
    }
    fn truthiness(&self, c: &mut Code) {
        c.bind(self.truth);
        c.call(self.check);
        c.load(Dx, Ax, 0);
        let false_ = c.label();
        let length = c.label();
        let value = c.label();
        c.immediate(7, Dx, 4);
        c.j(0x84, false_);
        c.immediate(7, Dx, 1);
        c.j(0x84, length);
        c.immediate(7, Dx, 2);
        c.j(0x84, length);
        c.immediate(7, Dx, 5);
        c.j(0x84, length);
        c.load(Ax, Ax, 8);
        c.load(Ax, Ax, 0);
        c.jump(value);
        c.bind(length);
        c.load(Ax, Ax, 16);
        c.bind(value);
        c.immediate(7, Ax, 0);
        c.j(0x84, false_);
        c.imm(Ax, 1);
        c.ret();
        c.bind(false_);
        c.zero(Ax);
        c.ret();
    }
    fn output(&self, c: &mut Code, integers: &runtime::Runtime) {
        c.bind(self.print);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 5);
        c.j(0x84, self.type_error);
        c.call(self.check);
        c.load(Dx, Ax, 0);
        let integer = c.label();
        let boolean = c.label();
        let none = c.label();
        let false_ = c.label();
        c.immediate(7, Dx, 0);
        c.j(0x84, integer);
        c.immediate(7, Dx, 2);
        c.j(0x84, self.bytes_print);
        c.immediate(7, Dx, 3);
        c.j(0x84, boolean);
        c.immediate(7, Dx, 4);
        c.j(0x84, none);
        c.load(Si, Ax, 8);
        c.load(Dx, Ax, 16);
        c.call(self.write);
        c.lea(Si, self.newline);
        c.imm(Dx, 1);
        c.jump(self.write);
        c.bind(integer);
        c.load(Ax, Ax, 8);
        c.jump(integers.print);
        c.bind(boolean);
        c.load(Ax, Ax, 8);
        c.load(Ax, Ax, 0);
        c.immediate(7, Ax, 0);
        c.j(0x84, false_);
        c.lea(Si, self.true_text);
        c.imm(Dx, 5);
        c.jump(self.write);
        c.bind(false_);
        c.lea(Si, self.false_text);
        c.imm(Dx, 6);
        c.jump(self.write);
        c.bind(none);
        c.lea(Si, self.none_text);
        c.imm(Dx, 5);
        c.jump(self.write);
        c.bind(self.write);
        let done = c.label();
        let retry = c.label();
        c.immediate(7, Dx, 0);
        c.j(0x84, done);
        c.bind(retry);
        c.imm(Ax, 1);
        c.imm(Di, 1);
        c.syscall();
        c.immediate(7, Ax, -4);
        c.j(0x84, retry);
        c.immediate(7, Ax, 0);
        c.j(0x8e, integers.io);
        c.add(Si, Ax);
        c.sub(Dx, Ax);
        c.j(0x85, retry);
        c.bind(done);
        c.ret();
    }
    fn put(c: &mut Code, value: i64) {
        c.imm(Ax, value);
        c.byte(R13, Ax);
        c.step(R13, false);
    }
    fn bytes_output(&self, c: &mut Code, integers: &runtime::Runtime) {
        c.bind(self.bytes_print);
        c.mov(R12, Ax);
        c.load(Ax, R12, 16);
        c.shift_left(Ax, 2);
        c.immediate(0, Ax, 4);
        c.j(0x82, integers.resource);
        c.call(integers.allocate);
        c.mov(Bx, Ax);
        c.mov(R13, Ax);
        // Scan quotes before formatting. Select double quotes only when an
        // apostrophe exists and a double quote does not (pinned bytes repr).
        c.load(R8, R12, 8);
        c.load(R9, R12, 16);
        c.zero(R10);
        c.zero(R11);
        let scan = c.label();
        let scanned = c.label();
        let single = c.label();
        let next = c.label();
        c.bind(scan);
        c.immediate(7, R9, 0);
        c.j(0x84, scanned);
        c.load_byte(Dx, R8);
        c.immediate(7, Dx, 39);
        c.j(0x84, single);
        c.immediate(7, Dx, 34);
        c.j(0x85, next);
        c.imm(R11, 1);
        c.jump(next);
        c.bind(single);
        c.imm(R10, 1);
        c.bind(next);
        c.step(R8, false);
        c.step(R9, true);
        c.jump(scan);
        c.bind(scanned);
        c.imm(Di, 39);
        let quote = c.label();
        c.immediate(7, R10, 0);
        c.j(0x84, quote);
        c.immediate(7, R11, 0);
        c.j(0x85, quote);
        c.imm(Di, 34);
        c.bind(quote);
        Self::put(c, 98);
        c.byte(R13, Di);
        c.step(R13, false);
        c.load(R8, R12, 8);
        c.load(R9, R12, 16);
        let loop_ = c.label();
        let done = c.label();
        let escaped = c.label();
        let tab = c.label();
        let newline = c.label();
        let carriage = c.label();
        let hex = c.label();
        let next = c.label();
        c.bind(loop_);
        c.immediate(7, R9, 0);
        c.j(0x84, done);
        c.load_byte(Dx, R8);
        c.step(R8, false);
        c.step(R9, true);
        c.cmp(Dx, Di);
        c.j(0x84, escaped);
        c.immediate(7, Dx, 92);
        c.j(0x84, escaped);
        c.immediate(7, Dx, 9);
        c.j(0x84, tab);
        c.immediate(7, Dx, 10);
        c.j(0x84, newline);
        c.immediate(7, Dx, 13);
        c.j(0x84, carriage);
        c.immediate(7, Dx, 32);
        c.j(0x82, hex);
        c.immediate(7, Dx, 127);
        c.j(0x83, hex);
        c.byte(R13, Dx);
        c.step(R13, false);
        c.jump(next);
        c.bind(escaped);
        Self::put(c, 92);
        c.byte(R13, Dx);
        c.step(R13, false);
        c.jump(next);
        for (label, letter) in [(tab, 116), (newline, 110), (carriage, 114)] {
            c.bind(label);
            Self::put(c, 92);
            Self::put(c, letter);
            c.jump(next);
        }
        c.bind(hex);
        Self::put(c, 92);
        Self::put(c, 120);
        c.mov(R10, Dx);
        c.shift_right(R10, 4);
        c.lea(R11, self.hex);
        c.add(R11, R10);
        c.load_byte(Ax, R11);
        c.byte(R13, Ax);
        c.step(R13, false);
        c.mov(R10, Dx);
        c.immediate(4, R10, 15);
        c.lea(R11, self.hex);
        c.add(R11, R10);
        c.load_byte(Ax, R11);
        c.byte(R13, Ax);
        c.step(R13, false);
        c.bind(next);
        c.jump(loop_);
        c.bind(done);
        c.byte(R13, Di);
        c.step(R13, false);
        Self::put(c, 10);
        c.mov(Si, Bx);
        c.mov(Dx, R13);
        c.sub(Dx, Bx);
        c.jump(self.write);
    }
}
