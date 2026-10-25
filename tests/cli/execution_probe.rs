//! Development-only process adapter probes, not NAJA language syntax.
#![forbid(unsafe_code)]
#![allow(dead_code)] // The included production module also exposes CLI-only discovery.
#[path = "../../bootstrap/driver/src/execution.rs"]
mod execution;
use std::{ffi::OsString, path::Path, time::Duration};

// The adapter's unused discovery routine calls the CLI extension checker.
fn source_dialect(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn elf(code: &[u8]) -> Vec<u8> {
    // Minimal independent Linux x86-64 executable fixture: one RX load segment.
    let mut image = vec![0; 120];
    image[..16].copy_from_slice(&[0x7f, b'E', b'L', b'F', 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    image[16..18].copy_from_slice(&2u16.to_le_bytes());
    image[18..20].copy_from_slice(&62u16.to_le_bytes());
    image[20..24].copy_from_slice(&1u32.to_le_bytes());
    image[24..32].copy_from_slice(&0x400078u64.to_le_bytes());
    image[32..40].copy_from_slice(&64u64.to_le_bytes());
    image[52..54].copy_from_slice(&64u16.to_le_bytes());
    image[54..56].copy_from_slice(&56u16.to_le_bytes());
    image[56..58].copy_from_slice(&1u16.to_le_bytes());
    image[64..68].copy_from_slice(&1u32.to_le_bytes());
    image[68..72].copy_from_slice(&5u32.to_le_bytes());
    image[80..88].copy_from_slice(&0x400000u64.to_le_bytes());
    image[88..96].copy_from_slice(&0x400000u64.to_le_bytes());
    let length = (120 + code.len()) as u64;
    image[96..104].copy_from_slice(&length.to_le_bytes());
    image[104..112].copy_from_slice(&length.to_le_bytes());
    image[112..120].copy_from_slice(&0x1000u64.to_le_bytes());
    image.extend_from_slice(code);
    image
}

fn main() {
    let arguments: Vec<_> = std::env::args_os().skip(1).collect();
    let runner = if arguments == [OsString::from("--runner"), OsString::from("wsl")] {
        execution::Runner::Wsl
    } else if arguments.is_empty() {
        execution::Runner::Direct
    } else {
        panic!("invalid probe options")
    };
    runner.prepare().unwrap();
    let timeout = Duration::from_secs(5);
    // Fixture walks argv[1..] from the initial Linux stack, writing each string
    // including its NUL terminator with SYS_write. No shell or library runtime.
    let argv_echo = elf(&[
        0x4c, 0x8b, 0x24, 0x24, // mov r12,[rsp]
        0x4c, 0x8d, 0x6c, 0x24, 0x10, // lea r13,[rsp+16]
        0x49, 0xff, 0xcc, // dec r12
        0x4d, 0x85, 0xe4, 0x74, 0x29, // test r12,r12; jz exit
        0x49, 0x8b, 0x75, 0x00, 0x31, 0xd2, // mov rsi,[r13]; xor edx,edx
        0x80, 0x3c, 0x16, 0x00, 0x74, 0x05, // cmp byte[rsi+rdx],0; je write
        0x48, 0xff, 0xc2, 0xeb, 0xf5, // inc rdx; jmp length
        0x48, 0xff, 0xc2, // include trailing NUL
        0xb8, 0x01, 0, 0, 0, 0xbf, 0x01, 0, 0, 0, 0x0f, 0x05, // SYS_write(1,rsi,rdx)
        0x49, 0x83, 0xc5, 0x08, 0x49, 0xff, 0xcc, 0xeb, 0xd2, // next argument
        0xb8, 0x3c, 0, 0, 0, 0x31, 0xff, 0x0f, 0x05, // SYS_exit(0)
    ]);
    let args = [
        "",
        "space here",
        "é𝄞",
        "--runner",
        "$(literal); & | >",
        "quote\"slash\\",
    ];
    let outcome =
        execution::execute(&argv_echo, &args.map(OsString::from), runner, timeout, true).unwrap();
    assert!(outcome.passed(), "{outcome:?}");
    assert_eq!(
        outcome.stdout,
        args.iter()
            .map(|value| format!("{value}\0"))
            .collect::<String>()
    );
    // Arbitrary numeric exit preservation, independently of language features.
    let exit_42 = elf(&[0xb8, 0x3c, 0, 0, 0, 0xbf, 42, 0, 0, 0, 0x0f, 0x05]);
    let outcome = execution::execute(&exit_42, &[], runner, timeout, true).unwrap();
    assert_eq!(outcome.exit_code, Some(42));
    assert_eq!(outcome.code(), 42);
    // SYS_getpid then SYS_kill(self,SIGTERM). WSL has only translated status.
    let signal = elf(&[
        0xb8, 39, 0, 0, 0, 0x0f, 0x05, 0x48, 0x89, 0xc7, 0xbe, 15, 0, 0, 0, 0xb8, 62, 0, 0, 0,
        0x0f, 0x05, 0x0f, 0x0b,
    ]);
    let outcome = execution::execute(&signal, &[], runner, timeout, true).unwrap();
    // The observed Windows WSL adapter returns 15 for this signaled process;
    // it must not be mislabeled as an observed Linux signal or exit 143.
    assert_eq!(
        outcome.code(),
        if runner == execution::Runner::Direct {
            143
        } else {
            15
        }
    );
    assert_eq!(
        outcome.signal,
        if runner == execution::Runner::Direct {
            Some(15)
        } else {
            None
        }
    );
    assert!(execution::execute(b"invalid executable", &[], runner, timeout, true).is_err());
    let raw_output = elf(&[
        0xb8, 1, 0, 0, 0, 0xbf, 1, 0, 0, 0, // SYS_write stdout
        0x48, 0x8d, 0x35, 0x1c, 0, 0, 0, // lea rsi,[rip+28] (data at45)
        0xba, 3, 0, 0, 0, 0x0f, 0x05, 0xb8, 1, 0, 0, 0, 0xbf, 2, 0, 0, 0, 0x0f,
        0x05, // SYS_write stderr
        0xb8, 60, 0, 0, 0, 0x31, 0xff, 0x0f, 0x05, 0xff, 0xc3,
        0, // invalid UTF-8 plus NUL, preserved as raw bytes
    ]);
    let outcome = execution::execute(&raw_output, &[], runner, timeout, true).unwrap();
    assert!(outcome.passed());
    assert_eq!(outcome.stdout_bytes, [0xff, 0xc3, 0]);
    assert_eq!(outcome.stderr_bytes, [0xff, 0xc3, 0]);
    assert!(std::str::from_utf8(&outcome.stdout_bytes).is_err());
    assert_eq!(execution::hex(&outcome.stdout_bytes), "ffc300");
    println!(
        "PASS native adapter argv bytes, exit42, SIGTERM observation, invalid-image cleanup and raw non-UTF-8 output"
    );
}
