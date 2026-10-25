//! Shared strict Unicode scalar-width encoder.
use crate::hosted::x64::{Code, R::*};
pub(super) fn emit_width(c: &mut Code, width: usize, utf8: usize) {
    // Validate one Unicode scalar, including shortest form, surrogate and
    // maximum-codepoint restrictions, before reading continuation bytes.
    // Input r8/r9; output width rax; preserve r8/r9/r12 and source frames.
    c.bind(width);
    c.immediate(7, R9, 0);
    c.j(0x84, utf8);
    c.load_byte(Dx, R8);
    let ascii = c.label();
    let two = c.label();
    let three = c.label();
    let four = c.label();
    c.immediate(7, Dx, 0x80);
    c.j(0x82, ascii);
    c.immediate(7, Dx, 0xc2);
    c.j(0x82, utf8);
    c.immediate(7, Dx, 0xe0);
    c.j(0x82, two);
    c.immediate(7, Dx, 0xf0);
    c.j(0x82, three);
    c.immediate(7, Dx, 0xf5);
    c.j(0x82, four);
    c.jump(utf8);
    c.bind(ascii);
    c.imm(Ax, 1);
    c.ret();
    c.bind(two);
    c.imm(Ax, 2);
    let continuation = c.label();
    c.jump(continuation);
    c.bind(three);
    c.imm(Ax, 3);
    c.jump(continuation);
    c.bind(four);
    c.imm(Ax, 4);
    c.bind(continuation);
    c.cmp(R9, Ax);
    c.j(0x82, utf8);
    c.mov(R10, R8);
    c.step(R10, false);
    c.load_byte(Cx, R10);
    for (lead, minimum, maximum) in [
        (0xe0, 0xa0, 0xbf),
        (0xed, 0x80, 0x9f),
        (0xf0, 0x90, 0xbf),
        (0xf4, 0x80, 0x8f),
    ] {
        let next = c.label();
        c.immediate(7, Dx, lead);
        c.j(0x85, next);
        c.immediate(7, Cx, minimum);
        c.j(0x82, utf8);
        c.immediate(7, Cx, maximum);
        c.j(0x87, utf8);
        c.bind(next);
    }
    c.mov(R11, Ax);
    c.step(R11, true);
    let continuation_loop = c.label();
    c.bind(continuation_loop);
    c.load_byte(Cx, R10);
    c.immediate(4, Cx, 0xc0);
    c.immediate(7, Cx, 0x80);
    c.j(0x85, utf8);
    c.step(R10, false);
    c.step(R11, true);
    c.j(0x85, continuation_loop);
    c.ret();
}
