use naja_native::dynamic::{self, Expression as E, Function, Program, Statement as S};

fn integer(value: &str) -> E {
    E::Integer(value.into())
}

#[test]
fn rational_children_and_unused_branches_are_validated() {
    for binary in [E::Rational, E::DivideExact] {
        for value in [
            binary(Box::new(E::Local(0)), Box::new(integer("1"))),
            binary(Box::new(integer("1")), Box::new(E::Local(0))),
        ] {
            assert!(dynamic::validate(&[S::Evaluate(value.clone())]).is_err());
            assert!(
                dynamic::validate(&[S::If(E::Boolean(false), vec![S::Evaluate(value)], vec![])])
                    .is_err()
            );
        }
    }
    for unary in [E::Numerator, E::Denominator] {
        let program = Program {
            body: vec![S::Evaluate(integer("0"))],
            functions: vec![Function {
                parameters: 0,
                body: vec![S::Return(unary(Box::new(E::Local(0))))],
            }],
        };
        assert!(dynamic::validate_program(&program).is_err());
    }
}

#[test]
fn rational_nodes_depth_and_literals_keep_existing_limits() {
    let mut value = integer("1");
    for _ in 0..128 {
        value = E::Numerator(Box::new(value));
    }
    assert!(dynamic::validate(&[S::Evaluate(value.clone())]).is_ok());
    value = E::Numerator(Box::new(value));
    assert!(dynamic::validate(&[S::Evaluate(value)]).is_err());
    assert!(
        dynamic::validate(&vec![
            S::Evaluate(E::Rational(
                Box::new(integer("1")),
                Box::new(integer("2"))
            ));
            4000
        ])
        .is_err()
    );
    assert!(
        dynamic::validate(&[S::Evaluate(E::Rational(
            Box::new(integer(&"1".repeat(1_048_577))),
            Box::new(integer("1"))
        ))])
        .is_err()
    );
}

#[test]
fn rational_emission_is_native_and_deterministic() {
    let source = [S::Print(E::Numerator(Box::new(E::Rational(
        Box::new(integer("-42")),
        Box::new(integer("-30")),
    ))))];
    let first = dynamic::emit_elf(&source).unwrap();
    assert_eq!(first, dynamic::emit_elf(&source).unwrap());
    assert_eq!(&first[..4], b"\x7fELF");
    assert_eq!(dynamic::MAX_RATIONAL_WORK, 1_000_000);
}
