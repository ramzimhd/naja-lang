//! Explicit capability observations; no installation or ambient project loading.
use crate::execution::Runner;
use naja_native::{MAX_LOCALS, dynamic};
use std::ffi::OsString;

pub const HELP: &str = "Usage: naja doctor [--json] [--runner direct|wsl]\n\nReport the compiler's declared host, native target, language subset and resource limits.\nWithout --runner, no external command or program is executed; runner readiness is not probed.\nAn explicit --runner checks runner preparation only, using the existing bounded local adapter. It does not compile or run a user program, install tools, access the network or modify projects.\nDirect execution requires Linux x86-64; WSL is an explicit Windows option. A passing preparation check is not full language, clean-host or sandbox acceptance.\n";

pub fn report(arguments: &[OsString]) -> Result<String, String> {
    let mut json = false;
    let mut runner = None;
    let mut index = 0;
    while index < arguments.len() {
        match arguments[index].to_str() {
            Some("--json") if !json => json = true,
            Some("--runner") if runner.is_none() => {
                index += 1;
                runner = Some(
                    match arguments.get(index).and_then(|value| value.to_str()) {
                        Some("direct") => Runner::Direct,
                        Some("wsl") => Runner::Wsl,
                        _ => return Err("NJA041: doctor --runner requires direct or wsl".into()),
                    },
                );
            }
            _ => {
                return Err(
                    "NJA041: invalid or duplicate doctor option; use naja doctor --help".into(),
                );
            }
        }
        index += 1;
    }
    if let Some(runner) = runner {
        runner.prepare()?;
    }
    let selected = runner.map_or("none", Runner::name);
    let status = if runner.is_some() {
        "prepared"
    } else {
        "not_probed"
    };
    let direct = cfg!(all(target_os = "linux", target_arch = "x86_64"));
    let wsl = cfg!(windows);
    if json {
        // All interpolated strings are compiler-owned constants or enum names,
        // never paths, environment values or arbitrary command output.
        Ok(format!(
            "{{\"schema_version\":1,\"compiler_version\":\"{}\",\"implementation\":\"experimental Rust seed\",\"host\":{{\"os\":\"{}\",\"arch\":\"{}\"}},\"emitted_targets\":[\"x86_64-unknown-linux-gnu\"],\"dialects\":{{\"naja\":\"2026.1\",\"python_subset\":\"3.15.0\"}},\"execution\":{{\"selected_runner\":\"{selected}\",\"preparation\":\"{status}\",\"direct_option_supported\":{direct},\"wsl_option_supported\":{wsl},\"user_program_executed\":false}},\"limits\":{{\"compilation_stack_bytes\":{},\"native_arena_bytes\":{},\"native_source_stack_bytes\":{},\"active_calls\":{},\"locals_per_frame\":{MAX_LOCALS},\"general_division_limb_product\":{}}},\"self_hosted\":false,\"cells_available\":false,\"lsp_available\":false,\"dap_available\":false,\"vsix_available\":false,\"limitations\":[\"Runner preparation is separate from executing generated code.\",\"Native source stack guards assume the documented ordinary OS stack availability.\",\"Hosted arena has no reclamation or runtime loop quota.\",\"Complete language, clean-host installation, FC1 and HATCH remain unverified.\"]}}\n",
            env!("CARGO_PKG_VERSION"),
            std::env::consts::OS,
            std::env::consts::ARCH,
            naja_seed::COMPILATION_STACK_BYTES,
            dynamic::ARENA_BYTES,
            dynamic::MAX_SOURCE_STACK_BYTES,
            dynamic::MAX_CALL_DEPTH,
            dynamic::MAX_DIVISION_LIMB_PRODUCT,
        ))
    } else {
        Ok(format!(
            "NAJA {} experimental Rust seed\nHost: {} {}\nEmitted target: x86_64-unknown-linux-gnu\nDialects: NAJA 2026.1; Python 3.15.0 compatibility subset\nExecution options: direct={direct}, explicit Windows WSL={wsl}\nRequested runner: {selected}; preparation: {status}; no user program executed\nCompilation stack: {} bytes; native arena: {} bytes; native source stack: {} bytes\nActive user calls: {}; locals per frame: {MAX_LOCALS}; general division limb-product limit: {}\nThe compiler executable does not invoke Python or Rust tools to check/build source. Rebuilding this temporary seed requires pinned Rust/Cargo and the host SDK linker.\nNative OS stack assumptions apply; the arena has no reclamation or runtime loop quota.\nSelf-hosting, native cells, LSP, DAP, VSIX, complete language and FC1/HATCH acceptance remain unavailable or unverified.\n",
            env!("CARGO_PKG_VERSION"),
            std::env::consts::OS,
            std::env::consts::ARCH,
            naja_seed::COMPILATION_STACK_BYTES,
            dynamic::ARENA_BYTES,
            dynamic::MAX_SOURCE_STACK_BYTES,
            dynamic::MAX_CALL_DEPTH,
            dynamic::MAX_DIVISION_LIMB_PRODUCT,
        ))
    }
}
