use naja_native::dynamic::{self, Expression as E, Function, Program, Statement as S};

#[test]
fn list_capacity_and_all_children_are_validated() {
    for count in [0, 1, 128] {
        assert!(dynamic::validate(&[S::Evaluate(E::List(vec![E::None; count]))]).is_ok());
    }
    assert!(dynamic::validate(&[S::Evaluate(E::List(vec![E::None; 129]))]).is_err());
    let bad = E::List(vec![E::None, E::Local(0)]);
    assert!(dynamic::validate(&[S::Evaluate(bad.clone())]).is_err());
    assert!(
        dynamic::validate(&[S::Evaluate(E::And(
            Box::new(E::Boolean(false)),
            Box::new(bad.clone())
        ))])
        .is_err()
    );
    assert!(
        dynamic::validate_program(&Program {
            body: vec![S::Print(E::None)],
            functions: vec![Function {
                parameters: 0,
                body: vec![S::Return(bad)]
            }]
        })
        .is_err()
    );
}

#[test]
fn set_index_validates_every_expression_including_unused_statements() {
    for statement in [
        S::SetIndex {
            sequence: E::Local(0),
            index: E::None,
            value: E::None,
        },
        S::SetIndex {
            sequence: E::None,
            index: E::Local(0),
            value: E::None,
        },
        S::SetIndex {
            sequence: E::None,
            index: E::None,
            value: E::Local(0),
        },
    ] {
        assert!(dynamic::validate(std::slice::from_ref(&statement)).is_err());
        assert!(
            dynamic::validate(&[S::If(E::Boolean(false), vec![statement.clone()], vec![])])
                .is_err()
        );
        assert!(
            dynamic::validate_program(&Program {
                body: vec![S::Print(E::None)],
                functions: vec![Function {
                    parameters: 0,
                    body: vec![S::Return(E::None), statement]
                }]
            })
            .is_err()
        );
    }
}

#[test]
fn list_and_store_share_global_limits() {
    let mut value = E::None;
    for _ in 0..128 {
        value = E::List(vec![value]);
    }
    assert!(dynamic::validate(&[S::Evaluate(value.clone())]).is_ok());
    assert!(dynamic::validate(&[S::Evaluate(E::List(vec![value]))]).is_err());
    let full = S::Evaluate(E::List(vec![E::None; 128]));
    assert!(dynamic::validate(&vec![full.clone(); 76]).is_ok());
    assert!(dynamic::validate(&vec![full; 77]).is_err());
    let store = S::SetIndex {
        sequence: E::None,
        index: E::None,
        value: E::None,
    };
    assert!(dynamic::validate(&vec![store.clone(); 2500]).is_ok());
    assert!(dynamic::validate(&vec![store; 2501]).is_err());
    assert!(
        dynamic::validate(&[S::Evaluate(E::List(vec![E::Text("x".repeat(600_000)); 2]))]).is_err()
    );
}
