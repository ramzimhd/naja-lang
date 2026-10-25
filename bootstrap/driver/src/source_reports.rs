//! Bounded original-source diagnostics for terminal and editor clients.
use naja_frontend::Diagnostic;
use std::path::Path;

const MAX_DIAGNOSTICS: usize = 32;

struct Lines<'a> {
    source: &'a str,
    starts: Vec<usize>,
    ends: Vec<usize>,
}

impl<'a> Lines<'a> {
    fn new(source: &'a str) -> Self {
        let mut starts = vec![0];
        let mut ends = Vec::new();
        let bytes = source.as_bytes();
        let mut index = 0;
        while index < bytes.len() {
            if matches!(bytes[index], b'\r' | b'\n') {
                ends.push(index);
                if bytes[index] == b'\r' && bytes.get(index + 1) == Some(&b'\n') {
                    index += 1;
                }
                starts.push(index + 1);
            }
            index += 1;
        }
        ends.push(source.len());
        Self {
            source,
            starts,
            ends,
        }
    }

    fn position(&self, offset: usize, utf16: bool) -> (usize, usize) {
        let mut offset = offset.min(self.source.len());
        while !self.source.is_char_boundary(offset) {
            offset -= 1;
        }
        let line = self
            .starts
            .partition_point(|start| *start <= offset)
            .saturating_sub(1);
        let prefix = &self.source[self.starts[line]..offset.min(self.ends[line])];
        let character = if utf16 {
            prefix.encode_utf16().count()
        } else {
            prefix.chars().count()
        };
        (line, character)
    }
}

pub fn human(path: &Path, source: &str, errors: &[Diagnostic]) -> String {
    let lines = Lines::new(source);
    let mut output = errors
        .iter()
        .take(MAX_DIAGNOSTICS)
        .map(|diagnostic| {
            let (line, character) = lines.position(diagnostic.span.start, false);
            format!(
                "{}:{}:{}: {}: {}",
                path.display(),
                line + 1,
                character + 1,
                diagnostic.code,
                diagnostic.message
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    if errors.len() > MAX_DIAGNOSTICS {
        output.push_str(&format!(
            "\nNJA007: {} additional diagnostics omitted",
            errors.len() - MAX_DIAGNOSTICS
        ));
    }
    output
}

pub fn json(path: &Path, source: &str, passed: bool, errors: &[Diagnostic]) -> String {
    let lines = Lines::new(source);
    let diagnostics = errors.iter().take(MAX_DIAGNOSTICS).map(|diagnostic| {
        let (line, character) = lines.position(diagnostic.span.start, true);
        let (end_line, end_character) = lines.position(diagnostic.span.end.max(diagnostic.span.start), true);
        format!("{{\"code\":{},\"message\":{},\"start\":{{\"line\":{line},\"character\":{character}}},\"end\":{{\"line\":{end_line},\"character\":{end_character}}}}}", crate::execution::json(diagnostic.code), crate::execution::json(&diagnostic.message))
    }).collect::<Vec<_>>().join(",");
    format!(
        "{{\"schema_version\":1,\"source\":{},\"status\":{},\"diagnostics\":[{diagnostics}],\"omitted_diagnostics\":{}}}",
        crate::execution::json(&path.to_string_lossy()),
        crate::execution::json(if passed { "passed" } else { "failed" }),
        errors.len().saturating_sub(MAX_DIAGNOSTICS)
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use naja_frontend::Span;

    #[test]
    fn original_utf8_ranges_map_to_utf16_with_all_line_endings() {
        let lines = Lines::new("é𝄞\r\nβ\rx\n");
        for (offset, position) in [
            (0, (0, 0)),
            (2, (0, 1)),
            (3, (0, 1)),
            (6, (0, 3)),
            (7, (0, 3)),
            (8, (1, 0)),
            (10, (1, 1)),
            (11, (2, 0)),
            (12, (2, 1)),
            (13, (3, 0)),
            (usize::MAX, (3, 0)),
        ] {
            assert_eq!(lines.position(offset, true), position, "{offset}");
        }
        assert_eq!(lines.position(6, false), (0, 2));
    }

    #[test]
    fn json_preserves_escaped_data_bounded_ranges_and_omission_count() {
        let diagnostic = Diagnostic {
            code: "NJA999",
            message: "é\"\\\n\0".into(),
            span: Span::new(2, 6),
        };
        let output = json(Path::new("é file.naja"), "é𝄞", false, &vec![diagnostic; 33]);
        assert!(output.contains("\"source\":\"é file.naja\",\"status\":\"failed\""));
        assert!(output.contains("\"message\":\"é\\\"\\\\\\n\\u0000\""));
        assert!(output.contains(
            "\"start\":{\"line\":0,\"character\":1},\"end\":{\"line\":0,\"character\":3}"
        ));
        assert_eq!(output.matches("\"code\":").count(), 32);
        assert!(output.ends_with("\"omitted_diagnostics\":1}"));
        assert!(
            json(Path::new("source.naja"), "", true, &[])
                .contains("\"status\":\"passed\",\"diagnostics\":[],\"omitted_diagnostics\":0")
        );
    }
}
