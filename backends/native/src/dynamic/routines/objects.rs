//! Bounded instance storage and native class dispatch, with no recursive walk.
use super::*;
use crate::dynamic::{Class, Function, MAX_OBJECT_FIELDS};
use std::collections::BTreeMap;

const TABLE_BYTES: i32 = 8 + 16 * MAX_OBJECT_FIELDS as i32;
const INSTANCE_BYTES: i32 = 24 + TABLE_BYTES;

fn arena_span(c: &mut Code, pointer: crate::hosted::x64::R, bytes: i32, error: usize) {
    c.mov(R10, pointer);
    c.mov(Cx, pointer);
    c.immediate(4, Cx, 7);
    c.j(0x85, error);
    c.mov(R11, R10);
    c.immediate(0, R11, bytes);
    c.j(0x82, error);
    c.mov(Cx, R14);
    c.immediate(5, Cx, ARENA_BYTES as i32);
    c.cmp(R10, Cx);
    c.j(0x82, error);
    c.cmp(R11, R15);
    c.j(0x87, error);
}

impl Runtime {
    pub(in crate::dynamic) fn objects(
        &self,
        c: &mut Code,
        integers: &runtime::Runtime,
        classes: &[Class],
        functions: &[Function],
        labels: &[usize],
        names: &BTreeMap<String, usize>,
    ) {
        let span = c.label();
        let metadata = c.label();
        let capacity = c.label();
        let missing = c.label();
        let bound = c.label();
        let find = c.label();
        let class_method = c.label();

        c.bind(self.new_object);
        c.immediate(7, Di, classes.len() as i32);
        c.j(0x83, metadata);
        c.imm(Ax, INSTANCE_BYTES as i64);
        c.call(integers.allocate);
        c.imm(Dx, 7);
        c.store(Ax, 0, Dx);
        c.mov(Bx, Ax);
        c.immediate(0, Bx, 24);
        c.store(Ax, 8, Bx);
        c.store(Ax, 16, Di);
        c.zero(Dx);
        c.store(Bx, 0, Dx);
        c.ret();

        // Preserve rax/rdi/rsi. Only bounded metadata is inspected; children
        // may reference this object or each other and are never traversed.
        c.bind(self.object_check);
        let readable = c.label();
        let arena_descriptor = c.label();
        c.mov(R11, Ax);
        c.immediate(0, R11, 24);
        c.j(0x82, span);
        c.lea(Dx, integers.zero);
        c.cmp(Ax, Dx);
        c.j(0x82, arena_descriptor);
        c.lea(Dx, self.sequence_data_end);
        c.cmp(R11, Dx);
        c.j(0x86, readable);
        c.bind(arena_descriptor);
        arena_span(c, Ax, 24, span);
        c.bind(readable);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 7);
        c.j(0x85, self.type_error);
        arena_span(c, Ax, 24, span);
        c.load(Dx, Ax, 16);
        c.immediate(7, Dx, classes.len() as i32);
        c.j(0x83, metadata);
        c.load(R8, Ax, 8);
        arena_span(c, R8, TABLE_BYTES, span);
        c.load(R9, R8, 0);
        c.immediate(7, R9, MAX_OBJECT_FIELDS as i32);
        c.j(0x87, span);
        c.ret();

        // Return a field's descriptor-pointer slot or zero. rdi retains the
        // checked receiver and rsi the name for subsequent class lookup.
        c.bind(find);
        c.mov(Di, Ax);
        c.call(self.object_check);
        c.immediate(0, R8, 8);
        let loop_ = c.label();
        let found = c.label();
        let absent = c.label();
        c.bind(loop_);
        c.immediate(7, R9, 0);
        c.j(0x84, absent);
        c.load(Dx, R8, 0);
        c.immediate(7, Dx, names.len() as i32);
        c.j(0x83, span);
        c.cmp(Dx, Si);
        c.j(0x84, found);
        c.immediate(0, R8, 16);
        c.step(R9, true);
        c.jump(loop_);
        c.bind(found);
        c.mov(Ax, R8);
        c.immediate(0, Ax, 8);
        c.ret();
        c.bind(absent);
        c.zero(Ax);
        c.ret();

        c.bind(self.get_attribute);
        c.call(find);
        c.immediate(7, Ax, 0);
        let stored = c.label();
        c.j(0x85, stored);
        c.call(class_method);
        c.jump(bound);
        c.bind(stored);
        c.load(Ax, Ax, 0);
        c.mov(R8, Ax);
        c.imm(R9, 24);
        c.call(self.span_check);
        c.jump(self.check);

        c.bind(self.set_attribute);
        c.push(Bp);
        c.mov(Bp, Sp);
        c.immediate(5, Sp, 32);
        c.store(Bp, -8, Di); // Value is evaluated before the target.
        c.store(Bp, -16, Ax);
        c.store(Bp, -24, Si);
        c.mov(Ax, Di);
        c.mov(R8, Ax);
        c.imm(R9, 24);
        c.call(self.span_check);
        c.call(self.check);
        c.load(Ax, Bp, -16);
        c.load(Si, Bp, -24);
        c.call(find);
        c.immediate(7, Ax, 0);
        let update = c.label();
        c.j(0x85, update);
        c.load(R8, Di, 8);
        c.load(R9, R8, 0);
        c.immediate(7, R9, MAX_OBJECT_FIELDS as i32);
        c.j(0x83, capacity);
        c.mov(Ax, R9);
        c.shift_left(Ax, 4);
        c.immediate(0, Ax, 8);
        c.add(Ax, R8);
        c.store(Ax, 0, Si);
        c.immediate(0, Ax, 8);
        c.step(R9, false);
        c.store(R8, 0, R9);
        c.bind(update);
        c.load(Dx, Bp, -8);
        c.store(Ax, 0, Dx);
        c.lea(Ax, self.none_value);
        c.mov(Sp, Bp);
        c.pop(Bp);
        c.ret();

        c.bind(self.resolve_method);
        c.call(find);
        c.immediate(7, Ax, 0);
        c.j(0x85, self.type_error); // Stored values shadow ordinary methods.
        c.jump(class_method);

        c.bind(self.initializer_result);
        c.mov(R8, Ax);
        c.imm(R9, 24);
        c.call(self.span_check);
        c.load(Dx, Ax, 0);
        c.immediate(7, Dx, 4);
        c.j(0x85, self.init_error);
        c.ret();

        c.bind(class_method);
        c.load(Dx, Di, 16);
        for (index, class) in classes.iter().enumerate() {
            let next_class = c.label();
            c.immediate(7, Dx, index as i32);
            c.j(0x85, next_class);
            for method in &class.methods {
                let next_method = c.label();
                c.immediate(7, Si, names[&method.name] as i32);
                c.j(0x85, next_method);
                c.lea(Ax, labels[method.function]);
                c.imm(Dx, functions[method.function].parameters as i64);
                c.ret();
                c.bind(next_method);
            }
            c.jump(missing);
            c.bind(next_class);
        }
        c.jump(metadata);

        c.bind(self.object_compare);
        for register in [Di, Si] {
            let plain = c.label();
            c.mov(Ax, register);
            c.load(Dx, Ax, 0);
            c.immediate(7, Dx, 7);
            c.j(0x85, plain);
            c.call(self.object_check);
            let checked = c.label();
            c.jump(checked);
            c.bind(plain);
            let other = c.label();
            c.immediate(7, Dx, 10);
            c.j(0x85, other);
            c.call(self.rational_check);
            c.jump(checked);
            c.bind(other);
            c.immediate(7, Dx, 5);
            c.j(0x83, self.type_error);
            c.bind(checked);
        }
        c.cmp(Di, Si);
        let different = c.label();
        c.j(0x85, different);
        c.imm(Ax, 3); // Equal but not ordered, like the existing None marker.
        c.ret();
        c.bind(different);
        c.imm(Ax, 2);
        c.ret();

        for (label, bytes, status) in [
            (
                span,
                b"NJA203: invalid native object span\n".as_slice(),
                103,
            ),
            (
                metadata,
                b"NJA203: invalid native class metadata\n".as_slice(),
                103,
            ),
            (
                capacity,
                b"NJA203: native object field limit exceeded\n".as_slice(),
                103,
            ),
            (
                missing,
                b"NJA210: native object attribute not found\n".as_slice(),
                110,
            ),
            (
                bound,
                b"NJA210: native bound-method values are unsupported\n".as_slice(),
                110,
            ),
            (
                self.method_arity,
                b"NJA205: native method argument count mismatch\n".as_slice(),
                105,
            ),
            (
                self.init_error,
                b"NJA205: native initializer must return None\n".as_slice(),
                105,
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
