//! Plan exact literal expansion without allocating coefficient or power strings.

pub(super) const MAX_LITERAL_BYTES: usize = 1_048_576;

pub(super) struct Expansion {
    mantissa_end: usize,
    numerator_bytes: usize,
    denominator_bytes: usize,
    numerator_zeros: usize,
    denominator_zeros: usize,
}

impl Expansion {
    /// The shared lexer has already validated the unsigned decimal numeric core.
    pub(super) fn plan(text: &str, remaining: usize) -> Result<Self, ()> {
        let mantissa_end = text.find(['e', 'E']).unwrap_or(text.len());
        let mut coefficient = 0usize;
        let mut fractional = 0usize;
        let mut after_dot = false;
        for byte in text[..mantissa_end].bytes() {
            match byte {
                b'0'..=b'9' => {
                    coefficient += 1;
                    fractional += usize::from(after_dot);
                }
                b'_' => {}
                b'.' if !after_dot => after_dot = true,
                _ => return Err(()),
            }
        }
        if coefficient == 0 {
            return Err(());
        }
        let mut magnitude = 0usize;
        let mut negative = false;
        if mantissa_end < text.len() {
            let exponent = &text[mantissa_end + 1..];
            let digits = match exponent.as_bytes().first() {
                Some(b'-') => {
                    negative = true;
                    &exponent[1..]
                }
                Some(b'+') => &exponent[1..],
                _ => exponent,
            };
            let bound = MAX_LITERAL_BYTES.checked_add(fractional).ok_or(())?;
            let mut seen_digit = false;
            for byte in digits.bytes() {
                if byte == b'_' {
                    continue;
                }
                if !byte.is_ascii_digit() {
                    return Err(());
                }
                seen_digit = true;
                magnitude = magnitude
                    .checked_mul(10)
                    .and_then(|value| value.checked_add(usize::from(byte - b'0')))
                    .filter(|value| *value <= bound)
                    .ok_or(())?;
            }
            if !seen_digit {
                return Err(());
            }
        }
        let (numerator_zeros, denominator_zeros) = if negative {
            (0, fractional.checked_add(magnitude).ok_or(())?)
        } else if magnitude >= fractional {
            (magnitude - fractional, 0)
        } else {
            (0, fractional - magnitude)
        };
        let numerator_bytes = coefficient.checked_add(numerator_zeros).ok_or(())?;
        let denominator_bytes = 1usize.checked_add(denominator_zeros).ok_or(())?;
        if numerator_bytes
            .checked_add(denominator_bytes)
            .is_none_or(|bytes| bytes > remaining.min(MAX_LITERAL_BYTES))
        {
            return Err(());
        }
        Ok(Self {
            mantissa_end,
            numerator_bytes,
            denominator_bytes,
            numerator_zeros,
            denominator_zeros,
        })
    }

    pub(super) fn bytes(&self) -> usize {
        self.numerator_bytes + self.denominator_bytes
    }

    /// Call only after atomically reserving `bytes()` in the parser ledger.
    pub(super) fn expand(self, text: &str) -> (String, String) {
        let mut numerator = String::with_capacity(self.numerator_bytes);
        numerator.extend(
            text[..self.mantissa_end]
                .chars()
                .filter(char::is_ascii_digit),
        );
        numerator.extend(std::iter::repeat_n('0', self.numerator_zeros));
        let mut denominator = String::with_capacity(self.denominator_bytes);
        denominator.push('1');
        denominator.extend(std::iter::repeat_n('0', self.denominator_zeros));
        (numerator, denominator)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn direct_pairs_preserve_zero_digits_and_never_cancel() {
        for (text, numerator, denominator) in [
            ("01.50e-2", "0150", "10000"),
            ("0.000", "0000", "1000"),
            (".5", "5", "10"),
            ("1.e3", "1000", "1"),
            ("10_000", "10000", "1"),
        ] {
            let plan = Expansion::plan(text, MAX_LITERAL_BYTES).unwrap();
            assert_eq!(plan.bytes(), numerator.len() + denominator.len());
            assert_eq!(plan.expand(text), (numerator.into(), denominator.into()));
        }
    }

    #[test]
    fn both_synthetic_literals_reserve_exact_remaining_bytes_before_expansion() {
        assert_eq!(Expansion::plan("1.00", 6).unwrap().bytes(), 6);
        assert!(Expansion::plan("1.00", 5).is_err());
        assert_eq!(
            Expansion::plan("0e-1048574", MAX_LITERAL_BYTES)
                .unwrap()
                .bytes(),
            MAX_LITERAL_BYTES
        );
        assert!(Expansion::plan("0e-1048575", MAX_LITERAL_BYTES).is_err());
        assert!(Expansion::plan("0e1048575", MAX_LITERAL_BYTES).is_err());
    }

    #[test]
    fn leading_zero_exponents_do_not_overflow_or_bypass_bounds() {
        let text = format!("1e{}1", "0".repeat(200));
        assert_eq!(
            Expansion::plan(&text, 3).unwrap().expand(&text),
            ("10".into(), "1".into())
        );
        for sign in ["", "+", "-"] {
            assert!(
                Expansion::plan(&format!("0e{sign}{}", "9".repeat(200)), MAX_LITERAL_BYTES)
                    .is_err()
            );
        }
    }
}
