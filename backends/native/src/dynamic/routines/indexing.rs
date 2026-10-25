//! Bounded sequence reads/stores and exact integer index normalization.
use super::*;

impl Runtime {
    pub(super) fn indexing(&self, c: &mut Code, integers: &runtime::Runtime) {
        let bounds = c.label();
        let span = c.label();
        let utf8 = c.label();
        let width = c.label();
        let check_span = self.span_check;
        // Private scratch frame, preserving source rbp and all arena registers.
        const TAG: i32 = -8;
        const DATA: i32 = -16;
        const LENGTH: i32 = -24;
        const MAGNITUDE: i32 = -32;
        const SIGN: i32 = -40;
        const COUNT: i32 = -48;
        const MUTATING: i32 = -56;
        const VALUE: i32 = -64;
        let enter = c.label();
        c.bind(self.index);
        c.zero(R10);
        c.jump(enter);
        c.bind(self.set_index);
        c.imm(R10, 1);
        c.bind(enter);
        c.push(Bp);
        c.mov(Bp, Sp);
        c.immediate(5, Sp, 64);
        c.store(Bp, MUTATING, R10);
        c.store(Bp, VALUE, Dx);
        let readable = c.label();
        c.immediate(7, R10, 0);
        c.j(0x84, readable);
        c.load(Dx, Di, 0);
        c.immediate(7, Dx, 6);
        c.j(0x85, self.type_error);
        c.bind(readable);
        c.mov(Ax, Di);
        c.call(self.check);
        c.load(Dx, Di, 0);
        c.immediate(7, Dx, 7);
        c.j(0x84, self.type_error);
        c.store(Bp, TAG, Dx);
        let sequence = c.label();
        c.immediate(7, Dx, 1);
        c.j(0x84, sequence);
        c.immediate(7, Dx, 2);
        c.j(0x84, sequence);
        c.immediate(7, Dx, 5);
        c.j(0x82, self.type_error);
        c.bind(sequence);
        c.load(R8, Di, 8);
        c.load(R9, Di, 16);
        c.immediate(7, Dx, 5);
        let byte_span = c.label();
        c.j(0x82, byte_span);
        c.shift_left(R9, 3);
        c.bind(byte_span);
        c.call(check_span);
        c.store(Bp, DATA, R8);
        c.store(Bp, LENGTH, R9);
        c.mov(Ax, Si);
        c.call(self.number);
        c.mov(R8, Ax);
        c.imm(R9, 16);
        c.call(check_span);
        c.load(Dx, Ax, 0);
        c.store(Bp, SIGN, Dx);
        c.load(Cx, Ax, 8);
        c.zero(R12);
        let normalized_index = c.label();
        c.immediate(7, Cx, 0);
        c.j(0x84, normalized_index);
        // Every sequence is at most 64 MiB, below the base1e9 first limb.
        // A canonical multi-limb magnitude therefore cannot be in range.
        c.immediate(7, Cx, 1);
        c.j(0x85, bounds);
        c.imm(R9, 20);
        c.call(check_span);
        c.zero(Cx);
        c.get(R12, Ax, Cx);
        c.bind(normalized_index);
        c.store(Bp, MAGNITUDE, R12);
        c.load(R8, Bp, DATA);
        c.load(R9, Bp, LENGTH);
        c.load(Ax, Bp, TAG);
        c.immediate(7, Ax, 1);
        let count_done = c.label();
        c.j(0x85, count_done);
        c.zero(R12);
        let count_loop = c.label();
        c.bind(count_loop);
        c.immediate(7, R9, 0);
        c.j(0x84, count_done);
        c.call(width);
        c.add(R8, Ax);
        c.sub(R9, Ax);
        c.step(R12, false);
        c.jump(count_loop);
        c.bind(count_done);
        c.load(Ax, Bp, TAG);
        c.immediate(7, Ax, 1);
        let count_ready = c.label();
        c.j(0x84, count_ready);
        c.mov(R12, R9);
        c.immediate(7, Ax, 5);
        let element_count = c.label();
        c.j(0x82, element_count);
        c.shift_right(R12, 3);
        c.bind(element_count);
        c.bind(count_ready);
        c.store(Bp, COUNT, R12);
        c.load(Ax, Bp, MAGNITUDE);
        c.load(Dx, Bp, SIGN);
        let positive = c.label();
        let position = c.label();
        c.immediate(7, Dx, 0);
        c.j(0x8d, positive);
        c.cmp(Ax, R12);
        c.j(0x87, bounds);
        c.sub(R12, Ax);
        c.mov(Ax, R12);
        c.jump(position);
        c.bind(positive);
        c.cmp(Ax, R12);
        c.j(0x83, bounds);
        c.bind(position);
        c.load(Dx, Bp, COUNT);
        c.cmp(Ax, Dx);
        c.j(0x83, bounds);
        // The normalized value is now proven to fit the sequence count.
        c.mov(R12, Ax);
        c.load(R8, Bp, DATA);
        c.load(R9, Bp, LENGTH);
        c.load(Ax, Bp, TAG);
        c.immediate(7, Ax, 5);
        let not_tuple = c.label();
        c.j(0x82, not_tuple);
        c.shift_left(R12, 3);
        c.add(R8, R12);
        c.store(Bp, COUNT, R8);
        c.load(Dx, Bp, MUTATING);
        c.immediate(7, Dx, 0);
        let selected = c.label();
        c.j(0x84, selected);
        c.load(Ax, Bp, VALUE);
        let validate_element = c.label();
        c.jump(validate_element);
        c.bind(selected);
        c.load(Ax, R8, 0);
        c.bind(validate_element);
        c.mov(R8, Ax);
        c.imm(R9, 24);
        c.call(check_span);
        c.call(self.check);
        c.load(Dx, Bp, MUTATING);
        c.immediate(7, Dx, 0);
        let end = c.label();
        c.j(0x84, end);
        c.load(R8, Bp, COUNT);
        c.store(R8, 0, Ax);
        c.jump(end);
        c.bind(not_tuple);
        c.immediate(7, Ax, 2);
        let text = c.label();
        c.j(0x85, text);
        c.add(R8, R12);
        c.load_byte(Ax, R8);
        c.call(self.small_integer);
        c.jump(end);
        c.bind(text);
        let walk = c.label();
        let found = c.label();
        c.bind(walk);
        c.immediate(7, R12, 0);
        c.j(0x84, found);
        c.call(width);
        c.add(R8, Ax);
        c.sub(R9, Ax);
        c.step(R12, true);
        c.jump(walk);
        c.bind(found);
        c.call(width);
        c.store(Bp, LENGTH, Ax);
        c.store(Bp, DATA, R8);
        c.imm(Ax, 24);
        c.call(integers.allocate);
        c.imm(Dx, 1);
        c.store(Ax, 0, Dx);
        c.load(Dx, Bp, DATA);
        c.store(Ax, 8, Dx);
        c.load(Dx, Bp, LENGTH);
        c.store(Ax, 16, Dx);
        c.bind(end);
        c.mov(Sp, Bp);
        c.pop(Bp);
        c.ret();

        c.bind(check_span);
        c.mov(R10, R8);
        c.add(R10, R9);
        c.j(0x82, span);
        // Literal data is read-only; allocated payloads and their immutable
        // views live through process exit. Never read across either region.
        let arena = c.label();
        let valid = c.label();
        // The shared canonical zero object starts the final contiguous data
        // region, before Bool/None descriptors and per-expression literals.
        c.lea(Dx, integers.zero);
        c.cmp(R8, Dx);
        c.j(0x82, arena);
        c.lea(Dx, self.sequence_data_end);
        c.cmp(R10, Dx);
        c.j(0x86, valid);
        c.bind(arena);
        c.mov(Dx, R14);
        c.immediate(5, Dx, ARENA_BYTES as i32);
        c.cmp(R8, Dx);
        c.j(0x82, span);
        c.cmp(R10, R15);
        c.j(0x87, span);
        c.bind(valid);
        c.ret();

        super::utf8::emit_width(c, width, utf8);
        for (label, message, status) in [
            (
                bounds,
                b"NJA207: sequence index out of range\n".as_slice(),
                107,
            ),
            (
                span,
                b"NJA203: invalid native sequence span\n".as_slice(),
                103,
            ),
            (utf8, b"NJA205: invalid native UTF-8 text\n".as_slice(), 105),
        ] {
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
    }
}
