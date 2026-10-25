use naja_native::dynamic::{self, Expression as E, Function, Program, Statement as S};

fn index(value: E, at: E) -> E {
    E::Index(Box::new(value), Box::new(at))
}

#[test]
fn both_index_operands_validate_even_in_skipped_branches() {
    for expression in [
        index(E::Local(0), E::Integer("0".into())),
        index(E::Text("a".into()), E::Local(0)),
    ] {
        assert!(dynamic::validate(&[S::Print(expression.clone())]).is_err());
        assert!(
            dynamic::validate(&[S::Print(E::And(
                Box::new(E::Boolean(false)),
                Box::new(expression)
            ))])
            .is_err()
        );
    }
    let source = Program {
        body: vec![S::Print(E::None)],
        functions: vec![Function {
            parameters: 0,
            body: vec![S::Return(index(E::Text("a".into()), E::Local(0)))],
        }],
    };
    assert!(dynamic::validate_program(&source).is_err());
}

#[test]
fn index_shares_depth_nodes_and_literal_limits() {
    let mut value = E::Text("a".into());
    for _ in 0..128 {
        value = index(value, E::Integer("0".into()));
    }
    assert!(dynamic::validate(&[S::Print(value.clone())]).is_ok());
    assert!(dynamic::validate(&[S::Print(index(value, E::Integer("0".into())))]).is_err());
    let operation = S::Print(index(E::Text("a".into()), E::Integer("0".into())));
    assert!(dynamic::validate(&vec![operation.clone(); 2500]).is_ok());
    assert!(dynamic::validate(&vec![operation; 2501]).is_err());
    assert!(
        dynamic::validate(&[S::Print(index(
            E::Text("a".repeat(1_048_576)),
            E::Integer("0".into())
        ))])
        .is_err()
    );
}

#[test]
fn huge_exact_indices_are_preserved_in_ir_and_static_emission() {
    let huge = "-".to_owned() + &"1234567890".repeat(1000);
    let source = vec![S::Print(index(E::Text("é𝄞\0".into()), E::Integer(huge)))];
    let a = dynamic::emit_elf(&source).unwrap();
    assert_eq!(a, dynamic::emit_elf(&source).unwrap());
    assert_eq!(u16::from_le_bytes(a[56..58].try_into().unwrap()), 2);
    assert_eq!(u32::from_le_bytes(a[68..72].try_into().unwrap()), 5);
    assert_eq!(
        u32::from_le_bytes(a[120..124].try_into().unwrap()),
        0x6474e551
    );
    assert_eq!(u32::from_le_bytes(a[124..128].try_into().unwrap()), 6);
}
