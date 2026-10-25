//! Bounded local execution plumbing. This is not a sandbox or a test-function engine.
use std::{
    ffi::{OsStr, OsString},
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, ExitStatus, Stdio},
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const OUTPUT_LIMIT: usize = 65_536;
const MAX_ENTRIES: usize = 4096;
const MAX_TESTS: usize = 256;
const MAX_DEPTH: usize = 16;
static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Runner {
    Direct,
    Wsl,
}

impl Runner {
    pub fn name(self) -> &'static str {
        match self {
            Self::Direct => "direct",
            Self::Wsl => "wsl",
        }
    }

    pub fn validate(self) -> Result<(), String> {
        match self {
            Self::Direct if cfg!(all(target_os = "linux", target_arch = "x86_64")) => Ok(()),
            Self::Wsl if cfg!(windows) => Ok(()),
            Self::Direct => Err("NJA010: native execution requires Linux x86-64; on Windows select --runner wsl explicitly".into()),
            Self::Wsl => Err("NJA010: --runner wsl is supported by the Windows CLI only".into()),
        }
    }

    pub fn prepare(self) -> Result<(), String> {
        self.validate()?;
        if self == Self::Wsl {
            let result = control(&[OsString::from("/usr/bin/uname"), OsString::from("-sm")])?;
            if result.trim() != "Linux x86_64" {
                return Err("NJA010: WSL must provide a Linux x86-64 execution target".into());
            }
            control(&[
                OsString::from("/usr/bin/timeout"),
                OsString::from("--version"),
            ])?;
        }
        Ok(())
    }
}

#[derive(Debug)]
pub struct Outcome {
    pub exit_code: Option<i32>,
    pub signal: Option<i32>,
    pub timed_out: bool,
    pub output_limit: bool,
    pub stdout: String,
    pub stderr: String,
    pub stdout_bytes: Vec<u8>,
    pub stderr_bytes: Vec<u8>,
}

impl Outcome {
    pub fn code(&self) -> i32 {
        if self.timed_out {
            124
        } else if self.output_limit {
            125
        } else {
            self.exit_code
                .unwrap_or_else(|| 128 + self.signal.unwrap_or(1))
        }
    }
    pub fn passed(&self) -> bool {
        self.exit_code == Some(0) && !self.timed_out && !self.output_limit && self.signal.is_none()
    }
    pub fn status(&self, runner: Runner) -> &'static str {
        if self.timed_out {
            "timed_out"
        } else if self.output_limit {
            "output_limit"
        } else if runner == Runner::Wsl && self.exit_code == Some(124) {
            "timeout_or_exit_124"
        } else if self.passed() {
            "passed"
        } else {
            "failed"
        }
    }
}

/// Only the file and empty directory created here are ever removed; no recursive deletion.
struct Artifact {
    directory: PathBuf,
    executable: PathBuf,
    file_owned: bool,
    directory_owned: bool,
}

impl Artifact {
    fn create(binary: &[u8], base: &Path) -> Result<Self, String> {
        if binary.len() > 16 * 1024 * 1024 {
            return Err("NJA011: temporary executable exceeds 16 MiB".into());
        }
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "NJA011: system clock precedes Unix epoch")?
            .as_nanos();
        for _ in 0..64 {
            let sequence = NEXT_TEMP.fetch_add(1, Ordering::Relaxed);
            let directory = base.join(format!(
                "naja-exec-{}-{now:x}-{sequence:x}",
                std::process::id()
            ));
            let builder = fs::DirBuilder::new();
            #[cfg(unix)]
            let builder = {
                use std::os::unix::fs::DirBuilderExt;
                let mut builder = builder;
                builder.mode(0o700);
                builder
            };
            match builder.create(&directory) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => {
                    return Err(format!(
                        "NJA011: cannot create private temporary directory: {error}"
                    ));
                }
            }
            let mut artifact = Self {
                executable: directory.join("program.elf"),
                directory,
                file_owned: false,
                directory_owned: true,
            };
            let mut options = OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o700);
            }
            let mut file = options
                .open(&artifact.executable)
                .map_err(|error| format!("NJA011: cannot create temporary executable: {error}"))?;
            artifact.file_owned = true;
            file.write_all(binary)
                .and_then(|()| file.sync_all())
                .map_err(|error| format!("NJA011: cannot write temporary executable: {error}"))?;
            return Ok(artifact);
        }
        Err("NJA011: temporary directory reservation exhausted after 64 collisions".into())
    }

    fn cleanup(&mut self) -> Result<(), String> {
        if self.file_owned {
            match fs::remove_file(&self.executable) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    return Err(format!(
                        "NJA011: temporary executable cleanup failed: {error}"
                    ));
                }
            }
            self.file_owned = false;
        }
        if !self.directory_owned {
            return Ok(());
        }
        match fs::remove_dir(&self.directory) {
            Ok(()) => {
                self.directory_owned = false;
                Ok(())
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                self.directory_owned = false;
                Ok(())
            }
            Err(error) => Err(format!(
                "NJA011: temporary directory cleanup failed: {error}"
            )),
        }
    }
}

impl Drop for Artifact {
    fn drop(&mut self) {
        let _ = self.cleanup();
    }
}

fn native_command(path: &Path, arguments: &[OsString]) -> Command {
    let mut command = Command::new(path);
    command.args(arguments);
    command
}

fn wsl_command(arguments: &[OsString]) -> Command {
    let mut command = Command::new("wsl.exe");
    command.arg("--exec").args(arguments);
    command
}

pub fn execute(
    binary: &[u8],
    arguments: &[OsString],
    runner: Runner,
    timeout: Duration,
    capture: bool,
) -> Result<Outcome, String> {
    runner.validate()?;
    validate_image(binary)?;
    let mut artifact = Artifact::create(binary, &std::env::temp_dir())?;
    let mut command = match runner {
        Runner::Direct => native_command(&artifact.executable, arguments),
        Runner::Wsl => {
            let windows_path = artifact
                .executable
                .to_str()
                .ok_or("NJA010: WSL temporary path must be Unicode")?
                .replace('\\', "/");
            let translated =
                control(&["/usr/bin/wslpath".into(), "-a".into(), windows_path.into()])?;
            let translated = translated.strip_suffix('\n').unwrap_or(&translated);
            if !translated.starts_with('/')
                || translated.contains('\0')
                || translated.contains('\n')
            {
                return Err("NJA010: WSL returned an invalid temporary executable path".into());
            }
            control(&["/usr/bin/chmod".into(), "u+x".into(), translated.into()])?;
            let mut argv = vec![
                "/usr/bin/timeout".into(),
                "--signal=TERM".into(),
                "--kill-after=1s".into(),
                format!(
                    "{}.{:03}s",
                    timeout.as_millis() / 1000,
                    timeout.as_millis() % 1000
                )
                .into(),
                translated.into(),
            ];
            argv.extend_from_slice(arguments);
            wsl_command(&argv)
        }
    };
    // The WSL target has its own deadline; allow its kill-after interval and adapter shutdown.
    let host_timeout = timeout
        + if runner == Runner::Wsl {
            Duration::from_secs(3)
        } else {
            Duration::ZERO
        };
    let outcome = wait(&mut command, host_timeout, capture)?;
    if let Err(error) = artifact.cleanup() {
        eprintln!("{error}");
    }
    Ok(outcome)
}

// Reject malformed/non-native images before the WSL timeout tool can attempt
// execvp's ENOEXEC shell fallback. Images come only from the current AOT library.
fn validate_image(bytes: &[u8]) -> Result<(), String> {
    let invalid = || "NJA012: invalid independent Linux x86-64 ELF image".to_string();
    if bytes.len() < 64 || &bytes[..7] != b"\x7fELF\x02\x01\x01" {
        return Err(invalid());
    }
    let u16_at = |offset| u16::from_le_bytes(bytes[offset..offset + 2].try_into().unwrap());
    let u32_at = |offset| u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
    let u64_at = |offset| u64::from_le_bytes(bytes[offset..offset + 8].try_into().unwrap());
    let count = usize::from(u16_at(56));
    if u16_at(16) != 2
        || u16_at(18) != 62
        || u32_at(20) != 1
        || u16_at(52) != 64
        || u16_at(54) != 56
        || u64_at(32) != 64
        || !(1..=16).contains(&count)
        || 64 + count * 56 > bytes.len()
    {
        return Err(invalid());
    }
    let entry = u64_at(24);
    let mut executable_entry = false;
    for index in 0..count {
        let offset = 64 + index * 56;
        let kind = u32_at(offset);
        if kind == 2 || kind == 3 {
            return Err(invalid());
        }
        if kind != 1 {
            continue;
        }
        let flags = u32_at(offset + 4);
        let file_offset = u64_at(offset + 8);
        let address = u64_at(offset + 16);
        let file_size = u64_at(offset + 32);
        let memory_size = u64_at(offset + 40);
        let alignment = u64_at(offset + 48);
        if file_size > memory_size
            || file_offset
                .checked_add(file_size)
                .is_none_or(|end| end > bytes.len() as u64)
            || address.checked_add(memory_size).is_none()
            || address < 65536
            || (alignment > 1
                && (!alignment.is_power_of_two() || address % alignment != file_offset % alignment))
            || flags & 3 == 3
        {
            return Err(invalid());
        }
        executable_entry |= flags & 1 != 0 && entry >= address && entry < address + file_size;
    }
    if executable_entry {
        Ok(())
    } else {
        Err(invalid())
    }
}

fn control(arguments: &[OsString]) -> Result<String, String> {
    let result = wait(&mut wsl_command(arguments), Duration::from_secs(5), true)?;
    if !result.passed() {
        return Err(format!(
            "NJA010: WSL adapter command failed (status {}): {}",
            result.code(),
            result.stderr
        ));
    }
    if std::str::from_utf8(&result.stdout_bytes).is_err()
        || std::str::from_utf8(&result.stderr_bytes).is_err()
    {
        return Err("NJA010: WSL adapter returned non-UTF-8 control output".into());
    }
    Ok(result.stdout)
}

fn capture_output(mut stream: impl Read, exceeded: Arc<AtomicBool>) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();
    let mut buffer = [0; 4096];
    loop {
        let count = stream
            .read(&mut buffer)
            .map_err(|error| format!("NJA012: cannot read child output: {error}"))?;
        if count == 0 {
            return Ok(output);
        }
        let keep = count.min(OUTPUT_LIMIT - output.len());
        output.extend_from_slice(&buffer[..keep]);
        if keep < count {
            exceeded.store(true, Ordering::Relaxed);
        }
    }
}

fn wait(command: &mut Command, timeout: Duration, capture: bool) -> Result<Outcome, String> {
    if capture {
        command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("NJA012: cannot start native process: {error}"))?;
    let exceeded = Arc::new(AtomicBool::new(false));
    let readers = if capture {
        let stdout = child
            .stdout
            .take()
            .ok_or("NJA012: child stdout pipe unavailable")?;
        let stderr = child
            .stderr
            .take()
            .ok_or("NJA012: child stderr pipe unavailable")?;
        let stdout_exceeded = exceeded.clone();
        let stderr_exceeded = exceeded.clone();
        Some((
            thread::spawn(move || capture_output(stdout, stdout_exceeded)),
            thread::spawn(move || capture_output(stderr, stderr_exceeded)),
        ))
    } else {
        None
    };
    let start = Instant::now();
    let mut timed_out = false;
    let mut output_limit = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {}
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("NJA012: cannot observe native process: {error}"));
            }
        }
        if start.elapsed() >= timeout || exceeded.load(Ordering::Relaxed) {
            timed_out = start.elapsed() >= timeout;
            output_limit = exceeded.load(Ordering::Relaxed);
            let _ = child.kill();
            break child
                .wait()
                .map_err(|error| format!("NJA012: cannot reap native process: {error}"))?;
        }
        thread::sleep(Duration::from_millis(5));
    };
    let (stdout, stderr) = if let Some((stdout, stderr)) = readers {
        (
            stdout
                .join()
                .map_err(|_| "NJA012: stdout reader failed")??,
            stderr
                .join()
                .map_err(|_| "NJA012: stderr reader failed")??,
        )
    } else {
        (Vec::new(), Vec::new())
    };
    output_limit |= exceeded.load(Ordering::Relaxed);
    Ok(Outcome {
        exit_code: status.code(),
        signal: signal(status),
        timed_out,
        output_limit,
        stdout: String::from_utf8_lossy(&stdout).into(),
        stderr: String::from_utf8_lossy(&stderr).into(),
        stdout_bytes: stdout,
        stderr_bytes: stderr,
    })
}

#[cfg(unix)]
fn signal(status: ExitStatus) -> Option<i32> {
    use std::os::unix::process::ExitStatusExt;
    status.signal()
}
#[cfg(not(unix))]
fn signal(_status: ExitStatus) -> Option<i32> {
    None
}

#[derive(Debug)]
pub struct TestFile {
    pub path: PathBuf,
    pub name: String,
}

pub fn discover(path: &Path, filter: Option<&str>) -> Result<Vec<TestFile>, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("NJA014: cannot inspect test path: {error}"))?;
    let mut files = Vec::new();
    if metadata.is_symlink() {
        return Err("NJA014: test path must not be a symbolic link".into());
    }
    if metadata.is_file() {
        crate::source_dialect(path)?;
        files.push(TestFile {
            name: path
                .file_name()
                .and_then(OsStr::to_str)
                .ok_or("NJA014: test names must be Unicode")?
                .into(),
            path: path.into(),
        });
    } else if metadata.is_dir() {
        visit(path, path, 0, &mut 0, &mut files)?;
    } else {
        return Err("NJA014: test path must be a regular file or directory".into());
    }
    files.sort_by(|left, right| left.name.cmp(&right.name));
    if let Some(filter) = filter {
        files.retain(|file| file.name.contains(filter));
    }
    if files.is_empty() {
        return Err("NJA014: no program test files selected".into());
    }
    Ok(files)
}

fn visit(
    root: &Path,
    directory: &Path,
    depth: usize,
    entries: &mut usize,
    files: &mut Vec<TestFile>,
) -> Result<(), String> {
    if depth > MAX_DEPTH {
        return Err("NJA014: test discovery exceeds depth 16".into());
    }
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("NJA014: cannot read test directory: {error}"))?
    {
        let entry = entry.map_err(|error| format!("NJA014: cannot read test entry: {error}"))?;
        *entries += 1;
        if *entries > MAX_ENTRIES {
            return Err("NJA014: test discovery exceeds 4096 entries".into());
        }
        let kind = entry
            .file_type()
            .map_err(|error| format!("NJA014: cannot inspect test entry: {error}"))?;
        if kind.is_symlink() {
            continue;
        }
        let entry_name = entry.file_name();
        let name = entry_name
            .to_str()
            .ok_or("NJA014: test discovery names must be Unicode")?;
        let path = entry.path();
        if kind.is_dir() {
            visit(root, &path, depth + 1, entries, files)?;
        } else if kind.is_file()
            && name.starts_with("test_")
            && (name.ends_with(".naja") || name.ends_with(".py"))
        {
            if files.len() == MAX_TESTS {
                return Err("NJA014: test discovery exceeds 256 program files".into());
            }
            let name = path
                .strip_prefix(root)
                .map_err(|_| "NJA014: invalid test path")?
                .iter()
                .map(|component| {
                    component
                        .to_str()
                        .ok_or("NJA014: test names must be Unicode")
                })
                .collect::<Result<Vec<_>, _>>()?
                .join("/");
            files.push(TestFile { path, name });
        }
    }
    Ok(())
}

pub fn json(value: &str) -> String {
    let mut result = String::from("\"");
    for character in value.chars() {
        match character {
            '"' => result.push_str("\\\""),
            '\\' => result.push_str("\\\\"),
            '\n' => result.push_str("\\n"),
            '\r' => result.push_str("\\r"),
            '\t' => result.push_str("\\t"),
            value if value <= '\u{1f}' => result.push_str(&format!("\\u{:04x}", value as u32)),
            value => result.push(value),
        }
    }
    result.push('"');
    result
}

pub fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(DIGITS[(byte >> 4) as usize] as char);
        output.push(DIGITS[(byte & 15) as usize] as char);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn arguments_remain_separate_and_literal() {
        let args = vec![
            "space here".into(),
            "$(touch malicious); &".into(),
            "é𝄞".into(),
            "--runner".into(),
            "".into(),
        ];
        let command = native_command(Path::new("program"), &args);
        assert_eq!(
            command.get_args().collect::<Vec<_>>(),
            args.iter().map(OsString::as_os_str).collect::<Vec<_>>()
        );
        let command = wsl_command(&args);
        assert_eq!(
            command.get_args().skip(1).collect::<Vec<_>>(),
            args.iter().map(OsString::as_os_str).collect::<Vec<_>>()
        );
    }

    #[test]
    fn artifact_cleanup_is_nonrecursive_and_never_overwrites() {
        let mut artifact = Artifact::create(b"not executable", &std::env::temp_dir()).unwrap();
        let directory = artifact.directory.clone();
        assert_eq!(fs::read(&artifact.executable).unwrap(), b"not executable");
        assert!(
            OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&artifact.executable)
                .is_err()
        );
        let extra = directory.join("retain");
        fs::write(&extra, b"unowned").unwrap();
        assert!(artifact.cleanup().is_err());
        fs::write(&artifact.executable, b"new unowned file").unwrap();
        let executable = artifact.executable.clone();
        drop(artifact);
        assert_eq!(fs::read(&extra).unwrap(), b"unowned");
        assert_eq!(fs::read(&executable).unwrap(), b"new unowned file");
        fs::remove_file(executable).unwrap();
        fs::remove_file(extra).unwrap();
        fs::remove_dir(directory).unwrap();
    }

    #[test]
    fn failed_creation_and_drop_leave_no_owned_artifact() {
        assert!(Artifact::create(b"x", Path::new("does-not-exist/naja-temp")).is_err());
        assert!(Artifact::create(&vec![0; 16 * 1024 * 1024 + 1], &std::env::temp_dir()).is_err());
        let artifact = Artifact::create(b"x", &std::env::temp_dir()).unwrap();
        let directory = artifact.directory.clone();
        drop(artifact);
        assert!(!directory.exists());
    }

    #[test]
    fn json_escapes_control_characters_without_losing_unicode() {
        assert_eq!(json("a\"\\\n\r\t\0é"), "\"a\\\"\\\\\\n\\r\\t\\u0000é\"");
    }

    #[test]
    fn only_valid_static_native_elf_images_reach_the_process_adapter() {
        let image = naja_seed::compile("print(1)\n").unwrap();
        validate_image(&image).unwrap();
        for length in 0..64 {
            assert!(validate_image(&image[..length]).is_err());
        }
        for (offset, value) in [(4, 1), (18, 3), (24, 0), (56, 0), (64, 3), (68, 7)] {
            let mut mutated = image.clone();
            mutated[offset] = value;
            // Setting only entry byte24 to0 does not always leave its segment;
            // clear its complete address for that mutation.
            if offset == 24 {
                mutated[24..32].fill(0);
            }
            assert!(validate_image(&mutated).is_err(), "offset {offset}");
        }
        assert!(validate_image(b"#!/bin/sh\nexit 0\n").is_err());
    }

    #[test]
    fn output_storage_is_bounded_and_overflow_is_observed() {
        let exceeded = Arc::new(AtomicBool::new(false));
        let output = capture_output(&vec![b'x'; OUTPUT_LIMIT + 1][..], exceeded.clone()).unwrap();
        assert_eq!(output.len(), OUTPUT_LIMIT);
        assert!(exceeded.load(Ordering::Relaxed));
    }

    #[test]
    fn discovery_is_sorted_filtered_and_bounded() {
        let artifact = Artifact::create(b"x", &std::env::temp_dir()).unwrap();
        let directory = &artifact.directory;
        fs::write(directory.join("test_z.py"), b"print(1)").unwrap();
        fs::write(directory.join("test_é.naja"), b"print(1)").unwrap();
        fs::write(directory.join("ordinary.naja"), b"not discovered").unwrap();
        let names = discover(directory, None)
            .unwrap()
            .into_iter()
            .map(|file| file.name)
            .collect::<Vec<_>>();
        assert_eq!(names, ["test_z.py", "test_é.naja"]);
        assert_eq!(discover(directory, Some("é")).unwrap().len(), 1);
        assert!(discover(directory, Some("absent")).is_err());
        assert!(discover(&directory.join("ordinary.naja"), None).is_ok());
        for index in 0..255 {
            fs::write(directory.join(format!("test_{index}.naja")), b"").unwrap();
        }
        assert!(
            discover(directory, Some("absent"))
                .unwrap_err()
                .contains("256")
        );
        for entry in fs::read_dir(directory).unwrap() {
            let path = entry.unwrap().path();
            if path != artifact.executable {
                fs::remove_file(path).unwrap();
            }
        }
    }

    #[cfg(unix)]
    #[test]
    fn discovery_preserves_unix_backslashes_and_rejects_nonunicode_names() {
        use std::os::unix::ffi::OsStringExt;
        let artifact = Artifact::create(b"x", &std::env::temp_dir()).unwrap();
        let flat = artifact.directory.join("test_folder\\test_value.py");
        let directory = artifact.directory.join("test_folder");
        fs::create_dir(&directory).unwrap();
        let nested = directory.join("test_value.py");
        fs::write(&flat, b"print(1)").unwrap();
        fs::write(&nested, b"print(2)").unwrap();
        let names = discover(&artifact.directory, None)
            .unwrap()
            .into_iter()
            .map(|file| file.name)
            .collect::<Vec<_>>();
        assert_eq!(
            names,
            ["test_folder/test_value.py", "test_folder\\test_value.py"]
        );
        let invalid = artifact
            .directory
            .join(OsString::from_vec(b"test_\xff.py".to_vec()));
        fs::write(&invalid, b"print(3)").unwrap();
        assert!(
            discover(&artifact.directory, None)
                .unwrap_err()
                .contains("must be Unicode")
        );
        fs::remove_file(invalid).unwrap();
        fs::remove_file(flat).unwrap();
        fs::remove_file(nested).unwrap();
        fs::remove_dir(directory).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn discovery_never_follows_symbolic_links() {
        use std::os::unix::fs::symlink;
        let artifact = Artifact::create(b"x", &std::env::temp_dir()).unwrap();
        let link = artifact.directory.join("test_link.py");
        symlink(&artifact.executable, &link).unwrap();
        assert!(
            discover(&artifact.directory, None)
                .unwrap_err()
                .contains("no program test")
        );
        assert!(discover(&link, None).unwrap_err().contains("symbolic link"));
        fs::remove_file(link).unwrap();
    }
}
