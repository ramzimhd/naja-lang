//! Inclusive Int/Bool checks with canonical scans and one cumulative work budget.
use super::*;
use crate::dynamic::MAX_INTEGER_INTERVAL_WORK;

const VALUE: i32 = -8;
const WORK: i32 = -16;
const LOWER: i32 = -24;
const UPPER: i32 = -32;
const VRAW: i32 = -40;
const LRAW: i32 = -48;
const URAW: i32 = -56;
const RAW: i32 = -64;
const COUNT: i32 = -72;
const SIGN: i32 = -80;
const KIND: i32 = -88;
const FRAME: i32 = 128;
const MAX_LIMBS: i32 = (ARENA_BYTES as i32 - 16) / 4;

fn span(c: &mut Code, size: i32, readable: usize, invalid: usize) {
    c.mov(Cx, Ax);
    c.immediate(4, Cx, 7);
    c.j(0x85, invalid);
    c.mov(R8, Ax);
    c.imm(R9, size as i64);
    c.call(readable);
}

impl Runtime {
    pub(super) fn intervals(&self, c: &mut Code, integers: &runtime::Runtime) {
        let scan = c.label();
        let compare = c.label();
        let charge = c.label();
        let readable = c.label();
        let invalid = c.label();
        let exhausted = c.label();
        let empty = c.label();
        let outside = c.label();

        // DI value, SI lower, DX upper; all children have already executed.
        c.bind(self.integer_interval);
        c.push(Bp);
        c.mov(Bp, Sp);
        c.immediate(5, Sp, FRAME);
        c.store(Bp, VALUE, Di);
        c.store(Bp, LOWER, Si);
        c.store(Bp, UPPER, Dx);
        c.imm(Ax, MAX_INTEGER_INTERVAL_WORK as i64);
        c.store(Bp, WORK, Ax);
        for offset in [VALUE, LOWER, UPPER] {
            c.load(Ax, Bp, offset);
            span(c, 24, readable, invalid);
        }
        // Every kind is checked before any descriptor metadata or raw payload.
        for offset in [VALUE, LOWER, UPPER] {
            c.load(Ax, Bp, offset);
            c.load(Dx, Ax, 0);
            let numeric = c.label();
            c.immediate(7, Dx, 0);
            c.j(0x84, numeric);
            c.immediate(7, Dx, 3);
            c.j(0x85, self.type_error);
            c.bind(numeric);
        }
        for (descriptor, raw) in [(VALUE, VRAW), (LOWER, LRAW), (UPPER, URAW)] {
            c.load(Ax, Bp, descriptor);
            c.call(scan);
            c.store(Bp, raw, Ax);
        }
        for (left, right, failure, condition) in [
            (LRAW, URAW, empty, 0x8f),
            (VRAW, LRAW, outside, 0x8c),
            (VRAW, URAW, outside, 0x8f),
        ] {
            c.load(Di, Bp, left);
            c.load(Si, Bp, right);
            c.call(compare);
            c.immediate(7, Ax, 0);
            c.j(condition, failure);
        }
        c.load(Ax, Bp, VALUE);
        c.mov(Sp, Bp);
        c.pop(Bp);
        c.ret();

        c.bind(scan);
        c.imm(Dx, 1);
        c.call(charge);
        c.load(Dx, Ax, 16);
        c.immediate(7, Dx, 0);
        c.j(0x85, invalid);
        c.load(Dx, Ax, 0);
        c.store(Bp, KIND, Dx);
        c.load(Ax, Ax, 8);
        c.store(Bp, RAW, Ax);
        span(c, 16, readable, invalid);
        c.load(Dx, Ax, 0);
        c.store(Bp, SIGN, Dx);
        c.load(R9, Ax, 8);
        c.immediate(7, R9, MAX_LIMBS);
        c.j(0x87, invalid);
        c.store(Bp, COUNT, R9);
        let nonzero = c.label();
        let header_ok = c.label();
        c.immediate(7, Dx, 0);
        c.j(0x85, nonzero);
        c.immediate(7, R9, 0);
        c.j(0x85, invalid);
        c.jump(header_ok);
        c.bind(nonzero);
        let sign_ok = c.label();
        c.immediate(7, Dx, 1);
        c.j(0x84, sign_ok);
        c.immediate(7, Dx, -1);
        c.j(0x85, invalid);
        c.bind(sign_ok);
        c.immediate(7, R9, 0);
        c.j(0x84, invalid);
        c.bind(header_ok);
        c.mov(R8, Ax);
        c.shift_left(R9, 2);
        c.immediate(0, R9, 16);
        c.call(readable);
        c.load(Dx, Bp, COUNT);
        c.step(Dx, false);
        c.call(charge);
        c.load(R12, Bp, RAW);
        c.load(R13, Bp, COUNT);
        c.zero(Cx);
        let loop_ = c.label();
        let scanned = c.label();
        c.immediate(7, R13, 0);
        c.j(0x84, scanned);
        c.bind(loop_);
        c.get(Dx, R12, Cx);
        c.immediate(7, Dx, 1_000_000_000);
        c.j(0x83, invalid);
        c.step(Cx, false);
        c.cmp(Cx, R13);
        c.j(0x85, loop_);
        c.immediate(7, Dx, 0);
        c.j(0x84, invalid);
        c.load(Cx, Bp, KIND);
        c.immediate(7, Cx, 3);
        c.j(0x85, scanned);
        c.immediate(7, R13, 1);
        c.j(0x85, invalid);
        c.immediate(7, Dx, 1);
        c.j(0x85, invalid);
        c.load(Dx, Bp, SIGN);
        c.immediate(7, Dx, 1);
        c.j(0x85, invalid);
        c.bind(scanned);
        c.load(Ax, Bp, RAW);
        c.ret();

        c.bind(compare);
        c.load(Dx, Di, 8);
        c.load(Cx, Si, 8);
        let maximum = c.label();
        c.cmp(Dx, Cx);
        c.j(0x83, maximum);
        c.mov(Dx, Cx);
        c.bind(maximum);
        c.shift_left(Dx, 1);
        c.step(Dx, false);
        c.call(charge);
        c.jump(integers.compare);
        c.bind(charge);
        c.load(R11, Bp, WORK);
        c.cmp(R11, Dx);
        c.j(0x82, exhausted);
        c.sub(R11, Dx);
        c.store(Bp, WORK, R11);
        c.ret();

        super::mappings::readable_span(c, readable, invalid, integers.zero, self.sequence_data_end);
        Self::division_error(
            c,
            invalid,
            b"NJA203: invalid native integer interval span\n",
            103,
        );
        Self::division_error(
            c,
            exhausted,
            b"NJA203: native integer interval work limit exceeded\n",
            103,
        );
        Self::division_error(c, outside, b"NJA212: integer interval check failed\n", 112);
        Self::division_error(c, empty, b"NJA213: empty integer interval\n", 113);
    }
}
