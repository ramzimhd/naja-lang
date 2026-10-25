//! Versioned source-name validation and NFKC canonicalization.
use crate::Span;
use std::fmt;
use unicode_normalization::UnicodeNormalization;

/// Frozen Unicode data version shared by source validation and normalization.
pub const IDENTIFIER_UNICODE_VERSION: (u8, u8, u8) = (17, 0, 0);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IdentifierErrorKind {
    Empty,
    InvalidStart,
    InvalidContinue,
}

/// The error span is relative to the supplied name, in original UTF-8 bytes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct IdentifierError {
    pub kind: IdentifierErrorKind,
    pub span: Span,
    pub character: Option<char>,
}

impl fmt::Display for IdentifierError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match (self.kind, self.character) {
            (IdentifierErrorKind::Empty, _) => write!(
                formatter,
                "An identifier must contain at least one character."
            ),
            (IdentifierErrorKind::InvalidStart, Some(ch)) => write!(
                formatter,
                "U+{:04X} is not permitted at the start of an identifier.",
                ch as u32
            ),
            (_, Some(ch)) => write!(
                formatter,
                "U+{:04X} is not permitted inside an identifier.",
                ch as u32
            ),
            (_, None) => write!(formatter, "Invalid identifier."),
        }
    }
}

impl std::error::Error for IdentifierError {}

pub(crate) fn is_start(ch: char) -> bool {
    ch == '_' || unicode_ident::is_xid_start(ch)
}

pub(crate) fn is_continue(ch: char) -> bool {
    unicode_ident::is_xid_continue(ch)
}

fn validate(name: &str) -> Result<(), IdentifierError> {
    let mut characters = name.char_indices();
    let Some((_, first)) = characters.next() else {
        return Err(IdentifierError {
            kind: IdentifierErrorKind::Empty,
            span: Span::new(0, 0),
            character: None,
        });
    };
    if !is_start(first) {
        return Err(IdentifierError {
            kind: IdentifierErrorKind::InvalidStart,
            span: Span::new(0, first.len_utf8()),
            character: Some(first),
        });
    }
    for (offset, ch) in characters {
        if !is_continue(ch) {
            return Err(IdentifierError {
                kind: IdentifierErrorKind::InvalidContinue,
                span: Span::new(offset, offset + ch.len_utf8()),
                character: Some(ch),
            });
        }
    }
    Ok(())
}

/// Validate a lexical NAME spelling: XID_Start plus underscore, then
/// XID_Continue. Raw keyword recognition remains the caller's responsibility.
pub fn is_identifier(name: &str) -> bool {
    validate(name).is_ok()
}

/// Return the NFKC symbol key without changing source text or token spans.
///
/// This service does not case-fold, normalize strings/labels, recognize raw
/// keywords, or reserve normalized lookalikes. Resolvers call it after raw
/// keyword handling and use its result for symbol identity and collisions.
pub fn canonical_identifier(name: &str) -> Result<String, IdentifierError> {
    validate(name)?;
    Ok(name.nfkc().collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versioned_xid_properties_match_official_data_for_every_unicode_scalar() {
        assert_eq!(unicode_ident::UNICODE_VERSION, IDENTIFIER_UNICODE_VERSION);
        assert_eq!(
            unicode_normalization::UNICODE_VERSION,
            IDENTIFIER_UNICODE_VERSION
        );
        let mut starts = vec![false; 0x110000];
        let mut continues = vec![false; 0x110000];
        let mut ranges = 0;
        for line in include_str!("../../../compatibility/unicode/xid-ranges-17.0.0.txt")
            .lines()
            .filter(|line| !line.starts_with('#') && !line.is_empty())
        {
            let columns: Vec<_> = line.split(';').collect();
            assert_eq!(columns.len(), 3);
            let table = match columns[0] {
                "XID_Start" => &mut starts,
                "XID_Continue" => &mut continues,
                other => panic!("Unknown property {other}"),
            };
            let first = usize::from_str_radix(columns[1], 16).unwrap();
            let last = usize::from_str_radix(columns[2], 16).unwrap();
            for cell in &mut table[first..=last] {
                assert!(!*cell, "Duplicate official property range");
                *cell = true;
            }
            ranges += 1;
        }
        assert_eq!(ranges, 2201);
        let mut scalars = 0;
        for value in 0..0x110000 {
            let Some(ch) = char::from_u32(value) else {
                continue;
            };
            assert_eq!(
                is_start(ch),
                starts[value as usize] || ch == '_',
                "XID_Start mismatch U+{value:04X}"
            );
            assert_eq!(
                is_continue(ch),
                continues[value as usize],
                "XID_Continue mismatch U+{value:04X}"
            );
            scalars += 1;
        }
        assert_eq!(scalars, 1_112_064);
    }

    fn from_codepoints(column: &str) -> String {
        column
            .split_whitespace()
            .map(|value| char::from_u32(u32::from_str_radix(value, 16).unwrap()).unwrap())
            .collect()
    }

    #[test]
    fn nfkc_matches_all_official_normalization_vectors_and_default_scalars() {
        let mut part_one = false;
        let mut explicitly_tested = vec![false; 0x110000];
        let mut vectors = 0;
        for line in include_str!("../../../compatibility/unicode/normalization-17.0.0.txt")
            .lines()
            .filter(|line| !line.starts_with('#') && !line.is_empty())
        {
            if line.starts_with('@') {
                part_one = line == "@Part1";
                continue;
            }
            let columns: Vec<_> = line.split(';').map(from_codepoints).collect();
            assert_eq!(columns.len(), 5);
            if part_one {
                assert_eq!(columns[0].chars().count(), 1);
                explicitly_tested[columns[0].chars().next().unwrap() as usize] = true;
            }
            for input in &columns {
                assert_eq!(
                    input.nfkc().collect::<String>(),
                    columns[3],
                    "Official NFKC vector {}: {line}",
                    vectors + 1
                );
            }
            vectors += 1;
        }
        assert_eq!(vectors, 20_034);
        // Official default invariant: scalars absent from Part 1 normalize to
        // themselves. Unassigned scalars additionally remain unchanged here.
        for (value, tested) in explicitly_tested.into_iter().enumerate() {
            if !tested && let Some(ch) = char::from_u32(value as u32) {
                assert_eq!(
                    ch.nfkc().collect::<String>(),
                    ch.to_string(),
                    "Default NFKC U+{value:04X}"
                );
            }
        }
    }
}
