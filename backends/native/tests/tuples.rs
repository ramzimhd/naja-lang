use naja_native::dynamic::{self, Expression as E, Function, Program, Statement as S};

#[test]
fn empty_and_128_elements_validate_but_129_do_not() {
    for count in [0, 1, 128] {
        assert!(dynamic::validate(&[S::Evaluate(E::Tuple(vec![E::None; count]))]).is_ok());
    }
    assert!(dynamic::validate(&[S::Evaluate(E::Tuple(vec![E::None; 129]))]).is_err());
}

#[test]
fn every_tuple_child_validates_including_skipped_and_unused_tuples() {
    let bad = E::Tuple(vec![E::None, E::Local(0)]);
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
fn tuple_children_share_global_literal_node_and_depth_budgets() {
    let mut value = E::None;
    for _ in 0..128 {
        value = E::Tuple(vec![value]);
    }
    assert!(dynamic::validate(&[S::Evaluate(value.clone())]).is_ok());
    assert!(dynamic::validate(&[S::Evaluate(E::Tuple(vec![value]))]).is_err());
    let full = S::Evaluate(E::Tuple(vec![E::None; 128]));
    assert!(dynamic::validate(&vec![full.clone(); 76]).is_ok());
    assert!(dynamic::validate(&vec![full; 77]).is_err());
    assert!(
        dynamic::validate(&[S::Evaluate(E::Tuple(vec![E::Text("x".repeat(600_000)); 2]))]).is_err()
    );
}

#[test]
fn deterministic_tuple_emission_retains_static_image_guards() {
    let source = vec![S::Evaluate(E::Tuple(vec![
        E::Text("é𝄞\0".into()),
        E::Integer("1".repeat(1000)),
        E::Tuple(vec![]),
    ]))];
    let image = dynamic::emit_elf(&source).unwrap();
    assert_eq!(image, dynamic::emit_elf(&source).unwrap());
    assert_eq!(u16::from_le_bytes(image[56..58].try_into().unwrap()), 2);
    assert_eq!(u32::from_le_bytes(image[68..72].try_into().unwrap()), 5);
    assert_eq!(
        u32::from_le_bytes(image[120..124].try_into().unwrap()),
        0x6474e551
    );
    assert_eq!(u32::from_le_bytes(image[124..128].try_into().unwrap()), 6);
}
