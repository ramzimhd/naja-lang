use naja_native::dynamic::{self, Expression as E, Function, Program, Statement as S};

#[test]
fn unary_file_operations_validate_all_operands_and_depth() {
    for constructor in [E::ReadFile, E::EncodeUtf8, E::DecodeUtf8] {
        assert!(dynamic::validate(&[S::Evaluate(constructor(Box::new(E::Local(0))))]).is_err());
        let mut value = E::None;
        for _ in 0..128 {
            value = constructor(Box::new(value));
        }
        assert!(dynamic::validate(&[S::Evaluate(value.clone())]).is_ok());
        assert!(dynamic::validate(&[S::Evaluate(constructor(Box::new(value)))]).is_err());
    }
}

#[test]
fn write_expression_and_statement_validate_both_trees_in_all_branches() {
    for (path, data) in [(E::Local(0), E::None), (E::None, E::Local(0))] {
        let statement = S::WriteFile {
            path: path.clone(),
            data: data.clone(),
        };
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
        assert!(
            dynamic::validate(&[S::Evaluate(E::WriteFile {
                path: Box::new(path),
                data: Box::new(data)
            })])
            .is_err()
        );
    }
}

#[test]
fn file_operations_share_literal_node_and_height_limits() {
    assert!(
        dynamic::validate(&vec![
            S::WriteFile {
                path: E::None,
                data: E::None
            };
            3333
        ])
        .is_ok()
    );
    assert!(
        dynamic::validate(&vec![
            S::WriteFile {
                path: E::None,
                data: E::None
            };
            3334
        ])
        .is_err()
    );
    assert!(
        dynamic::validate(&vec![
            S::Evaluate(E::WriteFile {
                path: Box::new(E::None),
                data: Box::new(E::None)
            });
            2500
        ])
        .is_ok()
    );
    assert!(
        dynamic::validate(&vec![
            S::Evaluate(E::WriteFile {
                path: Box::new(E::None),
                data: Box::new(E::None)
            });
            2501
        ])
        .is_err()
    );
    assert!(
        dynamic::validate(&[S::Evaluate(E::EncodeUtf8(Box::new(E::Text(
            "x".repeat(1_048_577)
        ))))])
        .is_err()
    );
}
