//! Exact native fractions, with shared integer kernels and one cumulative budget.
use super::*;
use crate::dynamic::MAX_RATIONAL_WORK;

const WORK: i32 = -8;
const MODE: i32 = -16;
const LEFT: i32 = -24;
const RIGHT: i32 = -32;
const AN: i32 = -40;
const AD: i32 = -48;
const BN: i32 = -56;
const BD: i32 = -64;
const NUM: i32 = -72;
const DEN: i32 = -80;
const GA: i32 = -88;
const GB: i32 = -96;
const G: i32 = -104;
const P: i32 = -112;
const Q: i32 = -120;
const VALUE: i32 = -128;
const KIND: i32 = -136;
const VN: i32 = -144;
const VD: i32 = -152;
const RAW: i32 = -160;
const COUNT: i32 = -168;
const SIGN: i32 = -176;
const BOOL: i32 = -184;
const FRAME: i32 = 256;
const MAX_LIMBS: i32 = (ARENA_BYTES as i32 - 16) / 4;

fn frame(c: &mut Code) {
    c.push(Bp);
    c.mov(Bp, Sp);
    c.immediate(5, Sp, FRAME);
}
fn finish(c: &mut Code) {
    c.mov(Sp, Bp);
    c.pop(Bp);
    c.ret();
}
fn one(c: &mut Code, target: crate::hosted::x64::R, value: usize) {
    c.lea(target, value);
    c.load(target, target, 8);
}
fn span(c: &mut Code, pointer: crate::hosted::x64::R, size: i32, check: usize, invalid: usize) {
    c.mov(Cx, pointer);
    c.immediate(4, Cx, 7);
    c.j(0x85, invalid);
    c.mov(R8, pointer);
    c.imm(R9, size as i64);
    c.call(check);
}
fn numeric_kind(c: &mut Code, value: crate::hosted::x64::R, error: usize, ratios: bool) {
    let valid = c.label();
    c.load(Dx, value, 0);
    c.immediate(7, Dx, 0);
    c.j(0x84, valid);
    c.immediate(7, Dx, 3);
    c.j(0x84, valid);
    if ratios {
        c.immediate(7, Dx, 10);
        c.j(0x84, valid);
    }
    c.jump(error);
    c.bind(valid);
}

impl Runtime {
    pub(super) fn rationals(&self, c: &mut Code, integers: &runtime::Runtime) {
        let enter = c.label();
        let done = c.label();
        let preflight = c.label();
        let raw_header = c.label();
        let raw_scan = c.label();
        let zero_form = c.label();
        let gcd = c.label();
        let normalize = c.label();
        let pack = c.label();
        let abs = c.label();
        let negate = c.label();
        let add = c.label();
        let subtract = c.label();
        let multiply = c.label();
        let compare = c.label();
        let divide = c.label();
        let charge = c.label();
        let readable = c.label();
        let invalid = c.label();
        let exhausted = c.label();
        let zero = c.label();

        // Generic guards must preserve the existing check ABI and allocate
        // nothing. Only constant metadata/span reads occur along this path.
        c.bind(self.rational_check);
        let saved = [Bx, Cx, Dx, Di, Si, R8, R9, R10, R11, R12, R13];
        for register in saved {
            c.push(register);
        }
        frame(c);
        c.store(Bp, VALUE, Ax);
        span(c, Ax, 24, readable, invalid);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 10);
        c.j(0x85, self.type_error);
        c.load(Dx, Ax, 8);
        c.store(Bp, VN, Dx);
        c.load(Ax, Ax, 16);
        c.store(Bp, VD, Ax);
        c.call(raw_header);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 1);
        c.j(0x85, invalid);
        c.load(Ax, Bp, VN);
        c.call(raw_header);
        c.call(zero_form);
        c.load(Ax, Bp, VALUE);
        c.mov(Sp, Bp);
        c.pop(Bp);
        for register in saved.into_iter().rev() {
            c.pop(register);
        }
        c.ret();

        // Modes0..5 have a descriptor pair in DI/SI; modes6..9 take AX.
        for (label, mode) in [
            (self.rational, 0),
            (self.divide_exact, 1),
            (self.rational_add, 2),
            (self.rational_subtract, 3),
            (self.rational_multiply, 4),
            (self.rational_compare, 5),
            (self.rational_negate, 6),
            (self.rational_positive, 7),
            (self.numerator, 8),
            (self.denominator, 9),
        ] {
            c.bind(label);
            if mode >= 6 {
                c.mov(Di, Ax);
            }
            c.imm(R10, mode);
            c.jump(enter);
        }
        c.bind(enter);
        frame(c);
        c.store(Bp, LEFT, Di);
        c.store(Bp, RIGHT, Si);
        c.store(Bp, MODE, R10);
        c.imm(Ax, MAX_RATIONAL_WORK as i64);
        c.store(Bp, WORK, Ax);
        c.mov(Ax, Di);
        span(c, Ax, 24, readable, invalid);
        let unary = c.label();
        c.load(Cx, Bp, MODE);
        c.immediate(7, Cx, 6);
        c.j(0x83, unary);
        c.load(Ax, Bp, RIGHT);
        span(c, Ax, 24, readable, invalid);
        c.load(Di, Bp, LEFT);
        c.load(Si, Bp, RIGHT);
        let constructor = c.label();
        let prechecked = c.label();
        c.load(Cx, Bp, MODE);
        c.immediate(7, Cx, 0);
        c.j(0x84, constructor);
        let numeric_pair = c.label();
        c.immediate(7, Cx, 5);
        c.j(0x85, numeric_pair);
        // Unrelated scalar equality preserves marker2; ordered comparison
        // rejects it in the shared emitter. Containers remain unsupported.
        let unrelated = c.label();
        for value in [Di, Si] {
            let numeric = c.label();
            c.load(Dx, value, 0);
            for tag in [0, 3, 10] {
                c.immediate(7, Dx, tag);
                c.j(0x84, numeric);
            }
            for tag in [1, 2, 4] {
                c.immediate(7, Dx, tag);
                c.j(0x84, unrelated);
            }
            c.jump(self.type_error);
            c.bind(numeric);
        }
        c.jump(numeric_pair);
        c.bind(unrelated);
        // Precheck both kinds, even if the first was unrelated.
        for value in [Di, Si] {
            let valid = c.label();
            c.load(Dx, value, 0);
            for tag in [0, 1, 2, 3, 4, 10] {
                c.immediate(7, Dx, tag);
                c.j(0x84, valid);
            }
            c.jump(self.type_error);
            c.bind(valid);
            let not_ratio = c.label();
            c.immediate(7, Dx, 10);
            c.j(0x85, not_ratio);
            c.mov(Ax, value);
            c.call(self.rational_check);
            c.bind(not_ratio);
        }
        c.imm(Ax, 2);
        c.jump(done);
        c.bind(numeric_pair);
        numeric_kind(c, Di, self.type_error, true);
        numeric_kind(c, Si, self.type_error, true);
        c.jump(prechecked);
        c.bind(constructor);
        numeric_kind(c, Di, self.type_error, false);
        numeric_kind(c, Si, self.type_error, false);
        c.bind(prechecked);
        c.load(Ax, Bp, LEFT);
        c.call(preflight);
        c.store(Bp, AN, Di);
        c.store(Bp, AD, Si);
        c.load(Ax, Bp, RIGHT);
        c.call(preflight);
        c.store(Bp, BN, Di);
        c.store(Bp, BD, Si);
        c.load(Cx, Bp, MODE);
        let construct = c.label();
        let exact = c.label();
        let sum = c.label();
        let product = c.label();
        c.immediate(7, Cx, 0);
        c.j(0x84, construct);
        c.immediate(7, Cx, 1);
        c.j(0x84, exact);
        c.immediate(7, Cx, 4);
        c.j(0x84, product);
        // Addition/subtraction/comparison share the two crossproducts.
        c.load(Di, Bp, AN);
        c.load(Si, Bp, BD);
        c.call(multiply);
        c.store(Bp, P, Ax);
        c.load(Di, Bp, BN);
        c.load(Si, Bp, AD);
        c.call(multiply);
        c.store(Bp, Q, Ax);
        c.load(Di, Bp, P);
        c.load(Si, Bp, Q);
        c.load(Cx, Bp, MODE);
        c.immediate(7, Cx, 5);
        c.j(0x85, sum);
        c.call(compare);
        c.jump(done);
        c.bind(sum);
        let difference = c.label();
        let summed = c.label();
        c.immediate(7, Cx, 3);
        c.j(0x84, difference);
        c.call(add);
        c.jump(summed);
        c.bind(difference);
        c.call(subtract);
        c.bind(summed);
        c.store(Bp, NUM, Ax);
        c.load(Di, Bp, AD);
        c.load(Si, Bp, BD);
        c.call(multiply);
        c.store(Bp, DEN, Ax);
        c.call(normalize);
        c.jump(done);
        c.bind(product);
        c.load(Di, Bp, AN);
        c.load(Si, Bp, BN);
        c.call(multiply);
        c.store(Bp, NUM, Ax);
        c.load(Di, Bp, AD);
        c.load(Si, Bp, BD);
        c.call(multiply);
        c.store(Bp, DEN, Ax);
        c.call(normalize);
        c.jump(done);
        c.bind(exact);
        c.load(Ax, Bp, BN);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 0);
        c.j(0x84, zero);
        c.load(Di, Bp, AN);
        c.load(Si, Bp, BD);
        c.call(multiply);
        c.store(Bp, NUM, Ax);
        c.load(Di, Bp, AD);
        c.load(Si, Bp, BN);
        c.call(multiply);
        c.store(Bp, DEN, Ax);
        c.call(normalize);
        c.jump(done);
        c.bind(construct);
        c.load(Dx, Bp, AN);
        c.store(Bp, NUM, Dx);
        c.load(Dx, Bp, BN);
        c.store(Bp, DEN, Dx);
        c.call(normalize);
        c.jump(done);
        c.bind(unary);
        c.load(Ax, Bp, LEFT);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 10);
        c.j(0x85, self.type_error);
        c.call(preflight);
        c.store(Bp, NUM, Di);
        c.store(Bp, DEN, Si);
        c.load(Cx, Bp, MODE);
        let positive = c.label();
        let numerator = c.label();
        let denominator = c.label();
        c.immediate(7, Cx, 7);
        c.j(0x84, positive);
        c.immediate(7, Cx, 8);
        c.j(0x84, numerator);
        c.immediate(7, Cx, 9);
        c.j(0x84, denominator);
        c.mov(Ax, Di);
        c.call(negate);
        c.store(Bp, NUM, Ax);
        c.call(pack);
        c.jump(done);
        c.bind(positive);
        c.load(Ax, Bp, LEFT);
        c.jump(done);
        c.bind(numerator);
        c.load(Ax, Bp, NUM);
        c.call(self.wrap);
        c.jump(done);
        c.bind(denominator);
        c.load(Ax, Bp, DEN);
        c.call(self.wrap);
        c.bind(done);
        finish(c);

        // AX raw integer, constant span/header checks, no limb traversal.
        c.bind(raw_header);
        c.store(Bp, RAW, Ax);
        span(c, Ax, 16, readable, invalid);
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
        c.ret();

        c.bind(zero_form);
        c.load(Ax, Bp, VN);
        c.load(Dx, Ax, 0);
        let not_zero = c.label();
        c.immediate(7, Dx, 0);
        c.j(0x85, not_zero);
        c.load(Ax, Bp, VD);
        Self::rational_one_check(c, invalid);
        c.bind(not_zero);
        c.ret();

        c.bind(raw_scan);
        c.call(raw_header);
        c.load(Dx, Bp, COUNT);
        c.step(Dx, false);
        c.call(charge);
        c.load(R12, Bp, RAW);
        c.load(R13, Bp, COUNT);
        c.zero(Cx);
        let scan = c.label();
        let scanned = c.label();
        c.immediate(7, R13, 0);
        c.j(0x84, scanned);
        c.bind(scan);
        c.get(Dx, R12, Cx);
        c.immediate(7, Dx, 1_000_000_000);
        c.j(0x83, invalid);
        c.step(Cx, false);
        c.cmp(Cx, R13);
        c.j(0x85, scan);
        c.immediate(7, Dx, 0);
        c.j(0x84, invalid);
        c.load(Cx, Bp, BOOL);
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

        c.bind(preflight);
        c.store(Bp, VALUE, Ax);
        c.imm(Dx, 1);
        c.call(charge);
        c.load(Dx, Ax, 0);
        c.store(Bp, KIND, Dx);
        c.store(Bp, BOOL, Dx);
        let ratio = c.label();
        c.immediate(7, Dx, 10);
        c.j(0x84, ratio);
        c.load(Ax, Ax, 8);
        c.call(raw_scan);
        c.mov(Di, Ax);
        one(c, Si, self.true_value);
        c.ret();
        c.bind(ratio);
        c.load(Dx, Ax, 8);
        c.store(Bp, VN, Dx);
        c.load(Dx, Ax, 16);
        c.store(Bp, VD, Dx);
        c.zero(Dx);
        c.store(Bp, BOOL, Dx);
        c.load(Ax, Bp, VN);
        c.call(raw_scan);
        c.load(Ax, Bp, VD);
        c.call(raw_scan);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 1);
        c.j(0x85, invalid);
        c.call(zero_form);
        c.load(Ax, Bp, VN);
        c.load(Dx, Ax, 0);
        let canonical = c.label();
        c.immediate(7, Dx, 0);
        c.j(0x84, canonical);
        c.call(abs);
        c.store(Bp, GA, Ax);
        c.load(Ax, Bp, VD);
        c.store(Bp, GB, Ax);
        c.call(gcd);
        Self::rational_one_check(c, invalid);
        c.bind(canonical);
        c.load(Di, Bp, VN);
        c.load(Si, Bp, VD);
        c.ret();

        c.bind(normalize);
        c.load(Ax, Bp, DEN);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 0);
        c.j(0x84, zero);
        let positive_den = c.label();
        c.j(0x8f, positive_den);
        c.load(Ax, Bp, NUM);
        c.call(negate);
        c.store(Bp, NUM, Ax);
        c.load(Ax, Bp, DEN);
        c.call(negate);
        c.store(Bp, DEN, Ax);
        c.bind(positive_den);
        c.load(Ax, Bp, NUM);
        c.load(Dx, Ax, 0);
        let nonzero_num = c.label();
        c.immediate(7, Dx, 0);
        c.j(0x85, nonzero_num);
        c.lea(Ax, integers.zero);
        c.store(Bp, NUM, Ax);
        one(c, Ax, self.true_value);
        c.store(Bp, DEN, Ax);
        c.jump(pack);
        c.bind(nonzero_num);
        c.call(abs);
        c.store(Bp, GA, Ax);
        c.load(Ax, Bp, DEN);
        c.store(Bp, GB, Ax);
        c.call(gcd);
        c.store(Bp, G, Ax);
        for offset in [NUM, DEN] {
            c.load(Di, Bp, offset);
            c.load(Si, Bp, G);
            c.call(divide);
            c.load(Cx, Dx, 8);
            c.immediate(7, Cx, 0);
            c.j(0x85, invalid);
            c.store(Bp, offset, Ax);
        }
        c.bind(pack);
        c.imm(Ax, 24);
        c.call(integers.allocate);
        c.imm(R10, 10);
        c.store(Ax, 0, R10);
        c.load(R8, Bp, NUM);
        c.store(Ax, 8, R8);
        c.load(R9, Bp, DEN);
        c.store(Ax, 16, R9);
        c.ret();

        c.bind(gcd);
        let iteration = c.label();
        let gcd_done = c.label();
        c.bind(iteration);
        c.load(Si, Bp, GB);
        c.load(Dx, Si, 0);
        c.immediate(7, Dx, 0);
        c.j(0x84, gcd_done);
        c.imm(Dx, 1);
        c.call(charge);
        c.load(Di, Bp, GA);
        c.load(Si, Bp, GB);
        c.call(divide);
        c.load(Cx, Bp, GB);
        c.store(Bp, GA, Cx);
        c.store(Bp, GB, Dx);
        c.jump(iteration);
        c.bind(gcd_done);
        c.load(Ax, Bp, GA);
        c.ret();

        c.bind(abs);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 0);
        let already_positive = c.label();
        c.j(0x8d, already_positive);
        c.jump(negate);
        c.bind(already_positive);
        c.ret();
        c.bind(negate);
        c.load(Dx, Ax, 8);
        c.shift_left(Dx, 1);
        c.step(Dx, false);
        c.call(charge);
        c.jump(integers.negate);

        // Cost arithmetic uses validated counts bounded by MAX_LIMBS. Even
        //132*n*(m+1)+8*(m+1) is below2^63; debit checks precede every kernel.
        for (label, operation, factor) in [
            (add, integers.add, 6),
            (subtract, integers.subtract, 6),
            (compare, integers.compare, 2),
        ] {
            c.bind(label);
            c.load(Dx, Di, 8);
            c.load(Cx, Si, 8);
            let maximum = c.label();
            c.cmp(Dx, Cx);
            c.j(0x83, maximum);
            c.mov(Dx, Cx);
            c.bind(maximum);
            c.imm(R8, factor);
            c.mul(Dx, R8);
            c.step(Dx, false);
            c.call(charge);
            c.jump(operation);
        }
        c.bind(multiply);
        c.load(Dx, Di, 8);
        c.load(Cx, Si, 8);
        c.mov(R8, Dx);
        c.mul(R8, Cx);
        c.shift_left(R8, 2);
        c.add(Dx, Cx);
        c.imm(R9, 3);
        c.mul(Dx, R9);
        c.add(Dx, R8);
        c.step(Dx, false);
        c.call(charge);
        c.jump(integers.multiply);
        c.bind(divide);
        c.load(Cx, Di, 8);
        c.load(R8, Si, 8);
        c.imm(Dx, 1);
        let charged_divide = c.label();
        let general = c.label();
        c.immediate(7, Cx, 0);
        c.j(0x84, charged_divide);
        c.immediate(7, R8, 1);
        c.j(0x85, general);
        c.mov(Dx, Cx);
        c.immediate(0, Dx, 2);
        c.shift_left(Dx, 3);
        c.step(Dx, false);
        c.jump(charged_divide);
        c.bind(general);
        c.step(R8, false);
        c.mov(Dx, Cx);
        c.mul(Dx, R8);
        c.imm(R9, 132);
        c.mul(Dx, R9);
        c.shift_left(R8, 3);
        c.add(Dx, R8);
        c.step(Dx, false);
        c.bind(charged_divide);
        c.call(charge);
        c.jump(self.raw_divrem);
        c.bind(charge);
        c.load(R11, Bp, WORK);
        c.cmp(R11, Dx);
        c.j(0x82, exhausted);
        c.sub(R11, Dx);
        c.store(Bp, WORK, R11);
        c.ret();

        super::mappings::readable_span(c, readable, invalid, integers.zero, self.sequence_data_end);
        Self::division_error(c, invalid, b"NJA203: invalid native rational span\n", 103);
        Self::division_error(
            c,
            exhausted,
            b"NJA203: native rational work limit exceeded\n",
            103,
        );
        Self::division_error(c, zero, b"NJA206: integer division by zero\n", 106);
    }

    fn rational_one_check(c: &mut Code, invalid: usize) {
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 1);
        c.j(0x85, invalid);
        c.load(Dx, Ax, 8);
        c.immediate(7, Dx, 1);
        c.j(0x85, invalid);
        c.zero(Cx);
        c.get(Dx, Ax, Cx);
        c.immediate(7, Dx, 1);
        c.j(0x85, invalid);
    }
}
