//! Fixed-size descriptor arrays. Construction/checking never traverses children.
use super::*;

impl Runtime {
    pub(super) fn tuples(&self, c: &mut Code, integers: &runtime::Runtime) {
        let construct = c.label();
        let constructor_resource = c.label();
        c.bind(self.list);
        c.imm(R11, 6);
        c.jump(construct);
        c.bind(self.tuple);
        c.imm(R11, 5);
        c.bind(construct);
        // Caller stack holds last element first. Keep source/count out of the
        // allocator's rax/r10 scratch registers; copy into original source order.
        c.immediate(7, Si, super::super::MAX_TUPLE_ELEMENTS as i32);
        c.j(0x87, constructor_resource);
        c.mov(R12, Di);
        c.mov(R13, Si);
        c.mov(Ax, Si);
        c.shift_left(Ax, 3);
        c.immediate(0, Ax, 24);
        c.call(integers.allocate);
        let list_tag = c.label();
        let tagged = c.label();
        c.immediate(7, R11, 6);
        c.j(0x84, list_tag);
        c.imm(Dx, 5);
        c.store(Ax, 0, Dx);
        c.jump(tagged);
        c.bind(list_tag);
        c.imm(Dx, 6);
        c.store(Ax, 0, Dx);
        c.bind(tagged);
        c.store(Ax, 16, R13);
        c.mov(R8, Ax);
        c.immediate(0, R8, 24);
        c.store(Ax, 8, R8);
        let copy = c.label();
        let done = c.label();
        c.bind(copy);
        c.immediate(7, R13, 0);
        c.j(0x84, done);
        c.step(R13, true);
        c.mov(Cx, R13);
        c.shift_left(Cx, 3);
        c.add(Cx, R12);
        c.load(Dx, Cx, 0);
        c.store(R8, 0, Dx);
        c.immediate(0, R8, 8);
        c.jump(copy);
        c.bind(done);
        c.ret();

        c.bind(constructor_resource);
        c.immediate(7, R11, 6);
        c.j(0x84, self.list_resource);
        c.jump(self.tuple_resource);

        c.bind(self.tuple_check);
        let invalid_span = c.label();
        c.load(R10, Ax, 16);
        c.immediate(7, R10, super::super::MAX_TUPLE_ELEMENTS as i32);
        c.j(0x87, invalid_span);
        c.shift_left(R10, 3);
        c.load(Dx, Ax, 8);
        c.mov(R11, Dx);
        c.add(R11, R10);
        c.j(0x82, invalid_span);
        c.mov(Cx, R14);
        c.immediate(5, Cx, ARENA_BYTES as i32);
        c.cmp(Dx, Cx);
        c.j(0x82, invalid_span);
        c.cmp(R11, R15);
        c.j(0x87, invalid_span);
        c.ret();
        c.bind(invalid_span);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 6);
        c.j(0x84, self.list_resource);
        c.jump(self.tuple_resource);

        c.bind(self.tuple_resource);
        let data = c.label();
        let message = b"NJA203: invalid native tuple span\n";
        c.imm(Ax, 1);
        c.imm(Di, 2);
        c.lea(Si, data);
        c.imm(Dx, message.len() as i64);
        c.syscall();
        c.exit(103);
        c.bind(data);
        c.a.bytes(message);
        c.bind(self.list_resource);
        let data = c.label();
        let message = b"NJA203: invalid native list span\n";
        c.imm(Ax, 1);
        c.imm(Di, 2);
        c.lea(Si, data);
        c.imm(Dx, message.len() as i64);
        c.syscall();
        c.exit(103);
        c.bind(data);
        c.a.bytes(message);
    }
}
