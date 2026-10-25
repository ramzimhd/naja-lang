//! Immutable descriptor-pointer arrays; construction never traverses children.
use super::*;

impl Runtime {
    pub(super) fn tuples(&self, c: &mut Code, integers: &runtime::Runtime) {
        c.bind(self.tuple);
        // Caller stack holds last element first. Keep source/count out of the
        // allocator's rax/r10 scratch registers; copy into original source order.
        c.immediate(7, Si, super::super::MAX_TUPLE_ELEMENTS as i32);
        c.j(0x87, self.tuple_resource);
        c.mov(R12, Di);
        c.mov(R13, Si);
        c.mov(Ax, Si);
        c.shift_left(Ax, 3);
        c.immediate(0, Ax, 24);
        c.call(integers.allocate);
        c.imm(Dx, 5);
        c.store(Ax, 0, Dx);
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

        c.bind(self.tuple_check);
        c.load(R10, Ax, 16);
        c.immediate(7, R10, super::super::MAX_TUPLE_ELEMENTS as i32);
        c.j(0x87, self.tuple_resource);
        c.shift_left(R10, 3);
        c.load(Dx, Ax, 8);
        c.mov(R11, Dx);
        c.add(R11, R10);
        c.j(0x82, self.tuple_resource);
        c.mov(Cx, R14);
        c.immediate(5, Cx, ARENA_BYTES as i32);
        c.cmp(Dx, Cx);
        c.j(0x82, self.tuple_resource);
        c.cmp(R11, R15);
        c.j(0x87, self.tuple_resource);
        c.ret();

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
    }
}
