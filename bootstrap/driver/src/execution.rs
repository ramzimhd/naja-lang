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

fn control(arguments: &[OsString]) -> Result<String, String> {
    let result = wait(&mut wsl_command(arguments), Duration::from_secs(5), true)?;
    if !result.passed() {
        return Err(format!(
            "NJA010: WSL adapter command failed (status {}): {}",
            result.code(),
            result.stderr
        ));
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
        let path = entry.path();
        if kind.is_dir() {
            visit(root, &path, depth + 1, entries, files)?;
        } else if kind.is_file()
            && entry.file_name().to_str().is_some_and(|name| {
                name.starts_with("test_") && (name.ends_with(".naja") || name.ends_with(".py"))
            })
        {
            if files.len() == MAX_TESTS {
                return Err("NJA014: test discovery exceeds 256 program files".into());
            }
            let name = path
                .strip_prefix(root)
                .map_err(|_| "NJA014: invalid test path")?
                .to_str()
                .ok_or("NJA014: test names must be Unicode")?
                .replace('\\', "/");
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
        drop(artifact);
        assert_eq!(fs::read(&extra).unwrap(), b"unowned");
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
