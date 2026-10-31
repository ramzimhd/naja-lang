use naja_native::dynamic::{self, Expression as E, Function, Program, Statement as S};

fn integer(value: &str) -> E {
    E::Integer(value.into())
}
fn interval(value: E, lower: E, upper: E) -> E {
    E::IntegerInterval(Box::new(value), Box::new(lower), Box::new(upper))
}

#[test]
fn interval_children_and_unused_code_are_validated() {
    for position in 0..3 {
        let mut children = [integer("1"), integer("0"), integer("2")];
        children[position] = E::Local(0);
        let [value, lower, upper] = children;
        let value = interval(value, lower, upper);
        assert!(dynamic::validate(&[S::Evaluate(value.clone())]).is_err());
        assert!(
            dynamic::validate(&[S::If(
                E::Boolean(false),
                vec![S::Evaluate(value.clone())],
                vec![]
            )])
            .is_err()
        );
        assert!(
            dynamic::validate_program(&Program {
                body: vec![],
                functions: vec![Function {
                    parameters: 0,
                    body: vec![S::Return(value)]
                }],
            })
            .is_err()
        );
    }
}

#[test]
fn interval_nodes_height_and_each_literal_keep_existing_limits() {
    for position in 0..3 {
        let mut children = [integer("1"), integer("0"), integer("2")];
        children[position] = integer(&"1".repeat(1_048_577));
        let [value, lower, upper] = children;
        assert!(dynamic::validate(&[S::Evaluate(interval(value, lower, upper))]).is_err());
    }
    let mut value = integer("1");
    for _ in 0..128 {
        value = interval(value, integer("0"), integer("2"));
    }
    assert!(dynamic::validate(&[S::Evaluate(value.clone())]).is_ok());
    assert!(
        dynamic::validate(&[S::Evaluate(interval(value, integer("0"), integer("2")))]).is_err()
    );
    let statement = S::Evaluate(interval(integer("1"), integer("0"), integer("2")));
    assert!(dynamic::validate(&vec![statement.clone(); 2000]).is_ok());
    assert!(dynamic::validate(&vec![statement; 2001]).is_err());
}

#[test]
fn interval_emission_is_native_deterministic_and_retains_work_cap() {
    let source = [S::Print(interval(
        integer("-42"),
        integer("-50"),
        integer("-30"),
    ))];
    let first = dynamic::emit_elf(&source).unwrap();
    assert_eq!(first, dynamic::emit_elf(&source).unwrap());
    assert_eq!(&first[..4], b"\x7fELF");
    assert_eq!(dynamic::MAX_INTEGER_INTERVAL_WORK, 1_000_000);
}
