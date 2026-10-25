//! Linux x86-64 UAPI: openat/read/write/fstat/close, without libc.
//! Layout/constants verified against local asm/stat.h, asm/unistd_64.h and
//! asm-generic/fcntl.h. Every entry owns one bounded 256-byte scratch frame.
use super::super::{MAX_FILE_BYTES, MAX_FILE_EINTR_RETRIES, MAX_FILE_SYSCALLS, MAX_PATH_BYTES};
use super::*;

const FD: i32 = -8;
const PATH: i32 = -16;
const DATA: i32 = -24;
const LENGTH: i32 = -32;
const INITIAL: i32 = -40;
const TOTAL: i32 = -48;
const BUFFER: i32 = -56;
const CALLS: i32 = -64;
const EINTR: i32 = -72;
const CALLNO: i32 = -80;
const RESULT: i32 = -88;
const KIND: i32 = -96;
const STAT: i32 = -256; // 144-byte x86-64 struct stat, ending before metadata.
const CHUNK: i32 = 65_536;

fn frame(c: &mut Code) {
    c.push(Bp);
    c.mov(Bp, Sp);
    c.immediate(5, Sp, 256);
    c.imm(Ax, -1);
    c.store(Bp, FD, Ax);
    c.imm(Ax, MAX_FILE_SYSCALLS as i64);
    c.store(Bp, CALLS, Ax);
    c.imm(Ax, MAX_FILE_EINTR_RETRIES as i64);
    c.store(Bp, EINTR, Ax);
}
fn finish(c: &mut Code) {
    c.mov(Sp, Bp);
    c.pop(Bp);
    c.ret();
}
fn checked_sequence(c: &mut Code, tag: i32, span: usize, type_error: usize) {
    c.mov(R8, Ax);
    c.imm(R9, 24);
    c.call(span);
    c.load(Dx, Ax, 0);
    c.immediate(7, Dx, tag);
    c.j(0x85, type_error);
    c.load(R8, Ax, 8);
    c.load(R9, Ax, 16);
    c.call(span);
}
fn allocate(c: &mut Code, integers: &runtime::Runtime, error: usize) {
    // Preflight while a handle may be open. No allocation or concurrent
    // mutation intervenes before the shared allocator repeats this check.
    c.mov(R11, Ax);
    c.immediate(0, R11, 7);
    c.j(0x82, error);
    c.immediate(4, R11, -8);
    c.mov(R10, R15);
    c.add(R10, R11);
    c.j(0x82, error);
    c.cmp(R10, R14);
    c.j(0x87, error);
    c.call(integers.allocate);
}

impl Runtime {
    pub(super) fn files(&self, c: &mut Code, integers: &runtime::Runtime) {
        let path = c.label();
        let retry = c.label();
        let stat = c.label();
        let close = c.label();
        let cleanup = c.label();
        let width = c.label();
        let io = c.label();
        let invalid_path = c.label();
        let path_limit = c.label();
        let file_limit = c.label();
        let grew = c.label();
        let arena = c.label();
        let limit = c.label();
        let invalid_utf8 = c.label();

        c.bind(self.read_file);
        c.mov(Di, Ax);
        frame(c);
        c.store(Bp, PATH, Di);
        c.call(path);
        c.imm(Ax, 257);
        c.imm(Di, -100);
        c.load(Si, Bp, PATH);
        c.imm(Dx, 0o2404000);
        c.zero(R10);
        c.call(retry); // NONBLOCK|NOFOLLOW|CLOEXEC
        c.immediate(7, Ax, 0);
        c.j(0x8c, io);
        c.store(Bp, FD, Ax);
        c.call(stat);
        c.load(Ax, Bp, STAT + 48);
        c.immediate(7, Ax, 0);
        c.j(0x8c, file_limit);
        c.immediate(7, Ax, MAX_FILE_BYTES as i32);
        c.j(0x87, file_limit);
        c.store(Bp, INITIAL, Ax);
        c.immediate(0, Ax, 25);
        allocate(c, integers, arena);
        c.store(Bp, BUFFER, Ax);
        c.imm(Dx, 2);
        c.store(Ax, 0, Dx);
        c.mov(R9, Ax);
        c.immediate(0, R9, 24);
        c.store(Ax, 8, R9);
        c.store(Bp, DATA, R9);
        c.zero(Dx);
        c.store(Ax, 16, Dx);
        c.store(Bp, TOTAL, Dx);
        let read_loop = c.label();
        let read_count = c.label();
        let eof = c.label();
        c.bind(read_loop);
        c.load(Dx, Bp, INITIAL);
        c.immediate(0, Dx, 1);
        c.load(R8, Bp, TOTAL);
        c.sub(Dx, R8);
        c.immediate(7, Dx, CHUNK);
        c.j(0x86, read_count);
        c.imm(Dx, CHUNK as i64);
        c.bind(read_count);
        c.load(Si, Bp, DATA);
        c.add(Si, R8);
        c.load(Di, Bp, FD);
        c.zero(Ax);
        c.call(retry);
        c.immediate(7, Ax, 0);
        c.j(0x84, eof);
        c.j(0x8c, io);
        c.cmp(Ax, Dx);
        c.j(0x87, io);
        c.load(R8, Bp, TOTAL);
        c.add(R8, Ax);
        c.j(0x82, grew);
        c.load(Dx, Bp, INITIAL);
        c.cmp(R8, Dx);
        c.j(0x87, grew);
        c.store(Bp, TOTAL, R8);
        c.jump(read_loop);
        c.bind(eof);
        c.load(Ax, Bp, BUFFER);
        c.load(Dx, Bp, TOTAL);
        c.store(Ax, 16, Dx);
        c.store(Bp, RESULT, Ax);
        c.call(close);
        c.load(Ax, Bp, RESULT);
        finish(c);

        c.bind(self.write_file);
        c.mov(R8, Di);
        c.mov(R9, Si);
        frame(c);
        c.store(Bp, PATH, R8);
        c.mov(Ax, R9);
        checked_sequence(c, 2, self.span_check, self.type_error);
        c.immediate(7, R9, MAX_FILE_BYTES as i32);
        c.j(0x87, file_limit);
        c.store(Bp, DATA, R8);
        c.store(Bp, LENGTH, R9);
        c.call(path);
        c.imm(Ax, 257);
        c.imm(Di, -100);
        c.load(Si, Bp, PATH);
        c.imm(Dx, 0o2404301);
        c.imm(R10, 0o600);
        c.call(retry); // WRONLY|CREAT|EXCL plus read safeguards
        c.immediate(7, Ax, 0);
        c.j(0x8c, io);
        c.store(Bp, FD, Ax);
        c.call(stat);
        c.zero(Ax);
        c.store(Bp, TOTAL, Ax);
        let write_loop = c.label();
        let write_count = c.label();
        let written = c.label();
        c.bind(write_loop);
        c.load(R8, Bp, TOTAL);
        c.load(Dx, Bp, LENGTH);
        c.sub(Dx, R8);
        c.j(0x84, written);
        c.immediate(7, Dx, CHUNK);
        c.j(0x86, write_count);
        c.imm(Dx, CHUNK as i64);
        c.bind(write_count);
        c.load(Si, Bp, DATA);
        c.add(Si, R8);
        c.load(Di, Bp, FD);
        c.imm(Ax, 1);
        c.call(retry);
        c.immediate(7, Ax, 0);
        c.j(0x8e, io);
        c.cmp(Ax, Dx);
        c.j(0x87, io);
        c.load(R8, Bp, TOTAL);
        c.add(R8, Ax);
        c.j(0x82, io);
        c.store(Bp, TOTAL, R8);
        c.jump(write_loop);
        c.bind(written);
        c.call(close);
        c.lea(Ax, self.none_value);
        finish(c);

        let convert = c.label();
        let validate = c.label();
        c.bind(self.encode_utf8);
        c.mov(Di, Ax);
        frame(c);
        c.mov(Ax, Di);
        checked_sequence(c, 1, self.span_check, self.type_error);
        c.imm(Dx, 2);
        c.jump(convert);
        c.bind(self.decode_utf8);
        c.mov(Di, Ax);
        frame(c);
        c.mov(Ax, Di);
        checked_sequence(c, 2, self.span_check, self.type_error);
        c.imm(Dx, 1);
        c.bind(convert);
        c.store(Bp, KIND, Dx);
        c.store(Bp, DATA, R8);
        c.store(Bp, LENGTH, R9);
        c.call(validate);
        c.imm(Ax, 24);
        allocate(c, integers, arena);
        c.load(Dx, Bp, KIND);
        c.store(Ax, 0, Dx);
        c.load(Dx, Bp, DATA);
        c.store(Ax, 8, Dx);
        c.load(Dx, Bp, LENGTH);
        c.store(Ax, 16, Dx);
        finish(c);

        c.bind(validate);
        let valid = c.label();
        let validate_loop = c.label();
        c.bind(validate_loop);
        c.immediate(7, R9, 0);
        c.j(0x84, valid);
        c.call(width);
        c.add(R8, Ax);
        c.sub(R9, Ax);
        c.jump(validate_loop);
        c.bind(valid);
        c.ret();

        c.bind(path);
        c.load(Ax, Bp, PATH);
        checked_sequence(c, 1, self.span_check, self.type_error);
        c.immediate(7, R9, MAX_PATH_BYTES as i32);
        c.j(0x87, path_limit);
        c.mov(R12, R8);
        c.mov(R13, R9);
        let path_loop = c.label();
        let path_valid = c.label();
        c.bind(path_loop);
        c.immediate(7, R9, 0);
        c.j(0x84, path_valid);
        c.load_byte(Dx, R8);
        c.immediate(7, Dx, 0);
        c.j(0x84, invalid_path);
        c.call(width);
        c.add(R8, Ax);
        c.sub(R9, Ax);
        c.jump(path_loop);
        c.bind(path_valid);
        c.mov(Ax, R13);
        c.immediate(0, Ax, 1);
        allocate(c, integers, arena);
        c.store(Bp, PATH, Ax);
        c.mov(R8, Ax);
        let copy = c.label();
        let copied = c.label();
        c.bind(copy);
        c.immediate(7, R13, 0);
        c.j(0x84, copied);
        c.load_byte(Dx, R12);
        c.byte(R8, Dx);
        c.step(R12, false);
        c.step(R8, false);
        c.step(R13, true);
        c.jump(copy);
        c.bind(copied);
        c.zero(Dx);
        c.byte(R8, Dx);
        c.ret();

        c.bind(stat);
        c.load(Di, Bp, FD);
        c.mov(Si, Bp);
        c.immediate(5, Si, -STAT);
        c.imm(Ax, 5);
        c.call(retry);
        c.immediate(7, Ax, 0);
        c.j(0x8c, io);
        c.load(Dx, Bp, STAT + 24);
        c.immediate(4, Dx, 0o170000);
        c.immediate(7, Dx, 0o100000);
        c.j(0x85, io);
        c.ret();

        c.bind(retry);
        c.store(Bp, CALLNO, Ax);
        let attempt = c.label();
        let completed = c.label();
        c.bind(attempt);
        c.load(R12, Bp, CALLS);
        c.immediate(7, R12, 0);
        c.j(0x84, limit);
        c.step(R12, true);
        c.store(Bp, CALLS, R12);
        c.load(Ax, Bp, CALLNO);
        c.syscall();
        c.immediate(7, Ax, -4);
        c.j(0x85, completed);
        c.load(R12, Bp, EINTR);
        c.immediate(7, R12, 0);
        c.j(0x84, limit);
        c.step(R12, true);
        c.store(Bp, EINTR, R12);
        c.jump(attempt);
        c.bind(completed);
        c.ret();

        c.bind(close);
        c.load(Di, Bp, FD);
        c.imm(Ax, -1);
        c.store(Bp, FD, Ax);
        c.imm(Ax, 3);
        c.syscall();
        c.immediate(7, Ax, 0);
        c.j(0x8c, io);
        c.ret();
        c.bind(cleanup);
        c.load(Di, Bp, FD);
        c.immediate(7, Di, 0);
        let cleaned = c.label();
        c.j(0x8c, cleaned);
        c.imm(Ax, -1);
        c.store(Bp, FD, Ax);
        c.imm(Ax, 3);
        c.syscall();
        c.bind(cleaned);
        c.ret();

        super::utf8::emit_width(c, width, invalid_utf8);
        for (label, message, status) in [
            (
                io,
                b"NJA208: native file operation failed\n".as_slice(),
                108,
            ),
            (
                invalid_path,
                b"NJA208: invalid native file path\n".as_slice(),
                108,
            ),
            (
                path_limit,
                b"NJA203: native path byte limit exceeded\n".as_slice(),
                103,
            ),
            (
                file_limit,
                b"NJA203: native file byte limit exceeded\n".as_slice(),
                103,
            ),
            (
                grew,
                b"NJA203: native file grew beyond initial size\n".as_slice(),
                103,
            ),
            (
                arena,
                b"NJA203: native value arena exhausted\n".as_slice(),
                103,
            ),
            (
                limit,
                b"NJA208: native file syscall or EINTR limit exceeded\n".as_slice(),
                108,
            ),
            (
                invalid_utf8,
                b"NJA209: invalid UTF-8 conversion\n".as_slice(),
                109,
            ),
        ] {
            c.bind(label);
            c.call(cleanup);
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
