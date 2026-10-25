//! Fixed-capacity ordered tables with exact scalar keys and bounded linear lookup.
use super::*;
use crate::dynamic::{MAX_MAPPING_ENTRIES, MAX_MAPPING_KEY_WORK};

const MAP: i32 = -8;
const KEY: i32 = -16;
const VALUE: i32 = -24;
const MODE: i32 = -32;
const INDEX: i32 = -40;
const COUNT: i32 = -48;
const TABLE: i32 = -56;
const WORK: i32 = -64;
const LEFT: i32 = -72;
const RIGHT: i32 = -80;
const KIND: i32 = -88;
const DATA: i32 = -96;
const LENGTH: i32 = -104;
const SIGN: i32 = -112;
const TEMP: i32 = -128;
const TABLE_BYTES: i32 = MAX_MAPPING_ENTRIES as i32 * 16;

fn frame(c: &mut Code, bytes: i32) {
    c.push(Bp);
    c.mov(Bp, Sp);
    c.immediate(5, Sp, bytes);
    c.imm(Ax, MAX_MAPPING_KEY_WORK as i64);
    c.store(Bp, WORK, Ax);
}
fn finish(c: &mut Code) {
    c.mov(Sp, Bp);
    c.pop(Bp);
    c.ret();
}
fn arena_span(c: &mut Code, pointer: crate::hosted::x64::R, bytes: i32, error: usize) {
    c.mov(R11, pointer);
    c.mov(Cx, pointer);
    c.immediate(4, Cx, 7);
    c.j(0x85, error);
    c.immediate(0, R11, bytes);
    c.j(0x82, error);
    c.mov(Cx, R14);
    c.immediate(5, Cx, ARENA_BYTES as i32);
    c.cmp(pointer, Cx);
    c.j(0x82, error);
    c.cmp(R11, R15);
    c.j(0x87, error);
}
pub(super) fn readable_span(c: &mut Code, label: usize, error: usize, zero: usize, end: usize) {
    c.bind(label);
    c.mov(R11, R8);
    c.add(R11, R9);
    c.j(0x82, error);
    let arena = c.label();
    let valid = c.label();
    c.lea(Cx, zero);
    c.cmp(R8, Cx);
    c.j(0x82, arena);
    c.lea(Cx, end);
    c.cmp(R11, Cx);
    c.j(0x86, valid);
    c.bind(arena);
    c.mov(Cx, R14);
    c.immediate(5, Cx, ARENA_BYTES as i32);
    c.cmp(R8, Cx);
    c.j(0x82, error);
    c.cmp(R11, R15);
    c.j(0x87, error);
    c.bind(valid);
    c.ret();
}

impl Runtime {
    pub(super) fn mappings(&self, c: &mut Code, integers: &runtime::Runtime) {
        let new = c.label();
        let enter = c.label();
        let lookup = c.label();
        let key = c.label();
        let equal = c.label();
        let charge = c.label();
        let width = c.label();
        let map_span = c.label();
        let key_span = c.label();
        let invalid = c.label();
        let invalid_key = c.label();
        let key_type = c.label();
        let work = c.label();
        let dict_capacity = c.label();
        let set_capacity = c.label();
        let missing = c.label();

        c.bind(self.dict);
        c.imm(Di, 8);
        c.jump(new);
        c.bind(self.set);
        c.imm(Di, 9);
        c.bind(new);
        c.imm(Ax, (24 + TABLE_BYTES) as i64);
        c.call(integers.allocate);
        c.store(Ax, 0, Di);
        c.mov(R13, Ax);
        c.immediate(0, R13, 24);
        c.store(Ax, 8, R13);
        c.zero(Dx);
        c.store(Ax, 16, Dx);
        c.ret();

        c.bind(self.mapping_check);
        c.mov(R8, Ax);
        c.imm(R9, 24);
        c.call(map_span);
        c.load(Dx, Ax, 0);
        let mapping = c.label();
        c.immediate(7, Dx, 8);
        c.j(0x84, mapping);
        c.immediate(7, Dx, 9);
        c.j(0x85, self.type_error);
        c.bind(mapping);
        arena_span(c, Ax, 24, invalid);
        c.load(Dx, Ax, 16);
        c.immediate(7, Dx, MAX_MAPPING_ENTRIES as i32);
        c.j(0x87, invalid);
        c.load(R8, Ax, 8);
        arena_span(c, R8, TABLE_BYTES, invalid);
        c.ret();

        c.bind(self.dict_get);
        c.zero(R10); // 0=get,1=dict set,2=contains,3=set insertion.
        c.jump(enter);
        c.bind(self.dict_set);
        c.imm(R10, 1);
        c.jump(enter);
        c.bind(self.contains);
        c.mov(Ax, Di); // Public membership is ELEMENT then CONTAINER.
        c.mov(Di, Si);
        c.mov(Si, Ax);
        c.imm(R10, 2);
        c.jump(enter);
        c.bind(self.set_add);
        c.imm(R10, 3);
        c.bind(enter);
        frame(c, 128);
        c.store(Bp, MAP, Di);
        c.store(Bp, KEY, Si);
        c.store(Bp, VALUE, Dx);
        c.store(Bp, MODE, R10);
        c.mov(Ax, Di);
        c.call(self.mapping_check);
        c.load(Dx, Bp, MODE);
        let any_mapping = c.label();
        c.immediate(7, Dx, 2);
        c.j(0x84, any_mapping);
        c.load(Cx, Ax, 0);
        c.immediate(7, Dx, 3);
        let dictionary = c.label();
        c.j(0x85, dictionary);
        c.immediate(7, Cx, 9);
        c.j(0x85, self.type_error);
        c.jump(any_mapping);
        c.bind(dictionary);
        c.immediate(7, Cx, 8);
        c.j(0x85, self.type_error);
        c.bind(any_mapping);
        c.load(Dx, Ax, 16);
        c.store(Bp, COUNT, Dx);
        c.load(Dx, Ax, 8);
        c.store(Bp, TABLE, Dx);
        c.load(Ax, Bp, KEY);
        c.call(key); // Always validate the query, including empty containers.
        c.load(Dx, Bp, MODE);
        c.immediate(7, Dx, 1);
        let value_checked = c.label();
        c.j(0x85, value_checked);
        c.load(Ax, Bp, VALUE);
        c.mov(R8, Ax);
        c.imm(R9, 24);
        c.call(self.span_check);
        c.call(self.check);
        c.bind(value_checked);
        c.zero(Ax);
        c.store(Bp, INDEX, Ax);
        c.jump(lookup);
        c.bind(lookup);
        c.load(R12, Bp, INDEX);
        c.load(Dx, Bp, COUNT);
        c.cmp(R12, Dx);
        let absent = c.label();
        c.j(0x84, absent);
        c.shift_left(R12, 4);
        c.load(Dx, Bp, TABLE);
        c.add(R12, Dx);
        c.load(Ax, R12, 0);
        c.store(Bp, RIGHT, Ax);
        c.call(key);
        c.load(Ax, Bp, KEY);
        c.store(Bp, LEFT, Ax);
        c.call(equal);
        c.immediate(7, Ax, 0);
        let found = c.label();
        c.j(0x85, found);
        c.load(Ax, Bp, INDEX);
        c.step(Ax, false);
        c.store(Bp, INDEX, Ax);
        c.jump(lookup);
        c.bind(found);
        c.load(Dx, Bp, MODE);
        let contains_true = c.label();
        let done = c.label();
        let update = c.label();
        c.immediate(7, Dx, 2);
        c.j(0x84, contains_true);
        c.immediate(7, Dx, 3);
        c.j(0x84, done);
        c.load(R12, Bp, INDEX);
        c.shift_left(R12, 4);
        c.load(Dx, Bp, TABLE);
        c.add(R12, Dx);
        c.load(Dx, Bp, MODE);
        c.immediate(7, Dx, 1);
        c.j(0x84, update);
        c.load(Ax, R12, 8);
        c.mov(R8, Ax);
        c.imm(R9, 24);
        c.call(self.span_check);
        c.call(self.check);
        finish(c);
        c.bind(contains_true);
        c.imm(Ax, 1);
        finish(c);
        c.bind(absent);
        c.load(Dx, Bp, MODE);
        c.immediate(7, Dx, 0);
        c.j(0x84, missing);
        c.immediate(7, Dx, 2);
        let insertion = c.label();
        c.j(0x85, insertion);
        c.zero(Ax);
        finish(c);
        c.bind(insertion);
        c.load(R12, Bp, COUNT);
        c.immediate(7, R12, MAX_MAPPING_ENTRIES as i32);
        let room = c.label();
        c.j(0x82, room);
        c.immediate(7, Dx, 3);
        c.j(0x84, set_capacity);
        c.jump(dict_capacity);
        c.bind(room);
        c.load(Ax, Bp, MAP);
        c.mov(Bx, R12);
        c.step(Bx, false);
        c.store(Ax, 16, Bx);
        c.shift_left(R12, 4);
        c.load(Dx, Bp, TABLE);
        c.add(R12, Dx);
        c.load(Ax, Bp, KEY);
        c.store(R12, 0, Ax); // Retain this descriptor on later equal-key updates.
        c.load(Dx, Bp, MODE);
        c.immediate(7, Dx, 3);
        c.j(0x85, update);
        c.lea(Dx, self.none_value);
        c.store(R12, 8, Dx);
        c.jump(done);
        c.bind(update);
        c.load(Dx, Bp, VALUE);
        c.store(R12, 8, Dx);
        c.bind(done);
        c.lea(Ax, self.none_value);
        finish(c);

        c.bind(self.dict_keys);
        c.mov(Di, Ax);
        frame(c, 1152); // 128 metadata bytes plus 128 guarded snapshot pointers.
        c.store(Bp, MAP, Di);
        c.mov(Ax, Di);
        c.call(self.mapping_check);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 8);
        c.j(0x85, self.type_error);
        c.load(Dx, Ax, 16);
        c.store(Bp, COUNT, Dx);
        c.load(Dx, Ax, 8);
        c.store(Bp, TABLE, Dx);
        c.zero(Ax);
        c.store(Bp, INDEX, Ax);
        let snapshot = c.label();
        let copied = c.label();
        c.bind(snapshot);
        c.load(R12, Bp, INDEX);
        c.load(Dx, Bp, COUNT);
        c.cmp(R12, Dx);
        c.j(0x84, copied);
        c.shift_left(R12, 4);
        c.load(Ax, Bp, TABLE);
        c.add(R12, Ax);
        c.load(Ax, R12, 0);
        c.call(key);
        c.load(Dx, Bp, COUNT);
        c.load(Cx, Bp, INDEX);
        c.sub(Dx, Cx);
        c.step(Dx, true);
        c.shift_left(Dx, 3);
        c.add(Dx, Sp);
        c.store(Dx, 0, Ax);
        c.step(Cx, false);
        c.store(Bp, INDEX, Cx);
        c.jump(snapshot);
        c.bind(copied);
        c.mov(Di, Sp);
        c.load(Si, Bp, COUNT);
        c.call(self.tuple);
        finish(c);

        // All scans debit a saved operation budget before touching payloads.
        c.bind(charge);
        c.load(R11, Bp, WORK);
        c.cmp(R11, Dx);
        c.j(0x82, work);
        c.sub(R11, Dx);
        c.store(Bp, WORK, R11);
        c.ret();

        c.bind(key);
        c.store(Bp, TEMP, Ax);
        c.mov(R8, Ax);
        c.imm(R9, 24);
        c.call(key_span);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 4);
        c.j(0x87, key_type);
        c.store(Bp, KIND, Dx);
        let key_done = c.label();
        c.j(0x84, key_done); // None has no payload.
        c.immediate(7, Dx, 1);
        let sequence_key = c.label();
        c.j(0x84, sequence_key);
        c.immediate(7, Dx, 2);
        c.j(0x84, sequence_key);
        c.load(R8, Ax, 8);
        c.store(Bp, DATA, R8);
        c.imm(R9, 16);
        c.call(key_span);
        c.load(Dx, R8, 0);
        c.store(Bp, SIGN, Dx);
        c.load(R9, R8, 8);
        c.immediate(7, R9, (ARENA_BYTES as i32 - 16) / 4);
        c.j(0x87, invalid_key);
        c.store(Bp, LENGTH, R9);
        c.immediate(7, Dx, 0);
        let nonzero = c.label();
        c.j(0x85, nonzero);
        c.immediate(7, R9, 0);
        c.j(0x85, invalid_key);
        c.jump(key_done);
        c.bind(nonzero);
        let sign_ok = c.label();
        c.immediate(7, Dx, 1);
        c.j(0x84, sign_ok);
        c.immediate(7, Dx, -1);
        c.j(0x85, invalid_key);
        c.bind(sign_ok);
        c.immediate(7, R9, 0);
        c.j(0x84, invalid_key);
        c.shift_left(R9, 2);
        c.immediate(0, R9, 16);
        c.call(key_span);
        c.load(Dx, Bp, LENGTH);
        c.call(charge);
        c.load(R12, Bp, DATA);
        c.load(R13, Bp, LENGTH);
        c.zero(Cx);
        let limbs = c.label();
        c.bind(limbs);
        c.get(Dx, R12, Cx);
        c.immediate(7, Dx, 1_000_000_000);
        c.j(0x83, invalid_key);
        c.step(Cx, false);
        c.cmp(Cx, R13);
        c.j(0x85, limbs);
        c.immediate(7, Dx, 0); // Last limb must be canonical/nonzero.
        c.j(0x84, invalid_key);
        c.load(Cx, Bp, KIND);
        c.immediate(7, Cx, 3);
        c.j(0x85, key_done);
        c.immediate(7, R13, 1);
        c.j(0x85, invalid_key);
        c.immediate(7, Dx, 1);
        c.j(0x85, invalid_key);
        c.load(Dx, Bp, SIGN);
        c.immediate(7, Dx, 1);
        c.j(0x85, invalid_key);
        c.jump(key_done);
        c.bind(sequence_key);
        c.load(R8, Ax, 8);
        c.load(R9, Ax, 16);
        c.immediate(7, R9, ARENA_BYTES as i32);
        c.j(0x87, invalid_key);
        c.call(key_span);
        c.mov(Dx, R9);
        c.call(charge);
        c.load(Dx, Bp, KIND);
        c.immediate(7, Dx, 2);
        c.j(0x84, key_done);
        let text_loop = c.label();
        c.bind(text_loop);
        c.immediate(7, R9, 0);
        c.j(0x84, key_done);
        c.call(width);
        c.add(R8, Ax);
        c.sub(R9, Ax);
        c.jump(text_loop);
        c.bind(key_done);
        c.load(Ax, Bp, TEMP);
        c.ret();

        c.bind(equal);
        c.load(Di, Bp, LEFT);
        c.load(Si, Bp, RIGHT);
        c.load(R8, Di, 0);
        c.load(R9, Si, 0);
        let numeric_left = c.label();
        let numeric = c.label();
        let sequence_equal = c.label();
        let true_ = c.label();
        let false_ = c.label();
        let compare = c.label();
        c.immediate(7, R8, 0);
        c.j(0x84, numeric_left);
        c.immediate(7, R8, 3);
        c.j(0x84, numeric_left);
        c.cmp(R8, R9);
        c.j(0x85, false_);
        c.immediate(7, R8, 4);
        c.j(0x84, true_);
        c.jump(sequence_equal);
        c.bind(numeric_left);
        c.immediate(7, R9, 0);
        c.j(0x84, numeric);
        c.immediate(7, R9, 3);
        c.j(0x85, false_);
        c.bind(numeric);
        c.load(R8, Di, 8);
        c.load(R9, Si, 8);
        c.load(Dx, R8, 0);
        c.load(Cx, R9, 0);
        c.cmp(Dx, Cx);
        c.j(0x85, false_);
        c.load(Dx, R8, 8);
        c.load(Cx, R9, 8);
        c.cmp(Dx, Cx);
        c.j(0x85, false_);
        c.jump(compare);
        c.bind(sequence_equal);
        c.load(Dx, Di, 16);
        c.load(Cx, Si, 16);
        c.cmp(Dx, Cx);
        c.j(0x85, false_);
        c.bind(compare);
        c.shift_left(Dx, 1);
        c.call(charge);
        c.call(self.compare);
        c.immediate(7, Ax, 0);
        c.j(0x85, false_);
        c.bind(true_);
        c.imm(Ax, 1);
        c.ret();
        c.bind(false_);
        c.zero(Ax);
        c.ret();

        readable_span(c, map_span, invalid, integers.zero, self.sequence_data_end);
        readable_span(
            c,
            key_span,
            invalid_key,
            integers.zero,
            self.sequence_data_end,
        );
        super::utf8::emit_width(c, width, invalid_key);
        for (label, bytes, status) in [
            (
                invalid,
                b"NJA203: invalid native mapping span\n".as_slice(),
                103,
            ),
            (
                invalid_key,
                b"NJA203: invalid native mapping key span\n".as_slice(),
                103,
            ),
            (
                key_type,
                b"NJA205: unsupported native mapping key type\n".as_slice(),
                105,
            ),
            (
                work,
                b"NJA203: native mapping key work limit exceeded\n".as_slice(),
                103,
            ),
            (
                dict_capacity,
                b"NJA203: native dictionary capacity exceeded\n".as_slice(),
                103,
            ),
            (
                set_capacity,
                b"NJA203: native set capacity exceeded\n".as_slice(),
                103,
            ),
            (
                missing,
                b"NJA211: dictionary key not found\n".as_slice(),
                111,
            ),
        ] {
            c.bind(label);
            let data = c.label();
            c.imm(Ax, 1);
            c.imm(Di, 2);
            c.lea(Si, data);
            c.imm(Dx, bytes.len() as i64);
            c.syscall();
            c.exit(status);
            c.bind(data);
            c.a.bytes(bytes);
        }
    }
}
