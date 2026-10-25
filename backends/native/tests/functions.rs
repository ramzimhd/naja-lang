use naja_native::dynamic::{self, Expression as E, Function, Program, Statement as S};

fn program(body: Vec<S>, functions: Vec<Function>) -> Program {
    Program { body, functions }
}
fn function(parameters: usize, body: Vec<S>) -> Function {
    Function { parameters, body }
}
fn call(index: usize, args: Vec<E>) -> E {
    E::Call(index, args)
}

#[test]
fn legacy_slices_reject_calls_and_returns() {
    assert!(dynamic::validate(&[S::Print(call(0, vec![]))]).is_err());
    assert!(dynamic::emit_elf(&[S::Return(E::None)]).is_err());
    assert!(dynamic::validate_program(&program(vec![S::Return(E::None)], vec![])).is_err());
}

#[test]
fn every_function_and_skipped_argument_is_validated() {
    let main = vec![S::Print(E::None)];
    for body in [
        vec![S::Print(E::Local(0))],
        vec![S::Return(call(2, vec![]))],
        vec![S::Return(E::None), S::Print(E::Local(1))],
    ] {
        assert!(
            dynamic::validate_program(&program(main.clone(), vec![function(0, body)])).is_err()
        );
    }
    let skipped = E::And(
        Box::new(E::Boolean(false)),
        Box::new(call(0, vec![E::Local(1)])),
    );
    assert!(
        dynamic::validate_program(&program(vec![S::Print(skipped)], vec![function(1, vec![])]))
            .is_err()
    );
    assert!(
        dynamic::validate_program(&program(
            vec![S::Print(call(0, vec![]))],
            vec![function(1, vec![])]
        ))
        .is_err()
    );
    assert!(dynamic::validate_program(&program(vec![S::Print(call(1, vec![]))], vec![])).is_err());
}

#[test]
fn independent_parameter_locals_and_live_branch_initialization() {
    let yes = vec![S::Return(E::None)];
    let no = vec![S::Assign(1, E::Local(0))];
    let body = vec![S::If(E::Local(0), yes, no), S::Return(E::Local(1))];
    let valid = program(
        vec![S::Print(call(0, vec![E::Boolean(false)]))],
        vec![function(1, body)],
    );
    assert!(dynamic::validate_program(&valid).is_ok());
    let invalid = program(
        vec![S::Assign(3, E::None)],
        vec![function(1, vec![S::Return(E::Local(3))])],
    );
    assert!(dynamic::validate_program(&invalid).is_err());
    let invalid = program(
        vec![S::Print(E::None)],
        vec![function(
            1,
            vec![
                S::While(E::Boolean(false), vec![S::Assign(1, E::None)]),
                S::Return(E::Local(1)),
            ],
        )],
    );
    assert!(dynamic::validate_program(&invalid).is_err());
}

#[test]
fn limits_apply_to_the_entire_program_including_unused_functions() {
    let main = vec![S::Print(E::None)];
    assert!(
        dynamic::validate_program(&program(main.clone(), vec![function(0, vec![]); 128])).is_ok()
    );
    assert!(
        dynamic::validate_program(&program(main.clone(), vec![function(0, vec![]); 129])).is_err()
    );
    assert!(
        dynamic::validate_program(&program(main.clone(), vec![function(129, vec![])])).is_err()
    );
    let full = program(
        vec![S::Print(call(0, vec![E::None; 128]))],
        vec![function(128, vec![S::Return(E::Local(127))])],
    );
    assert!(dynamic::validate_program(&full).is_ok());
    let full = program(
        main.clone(),
        vec![function(0, vec![S::Print(E::None); 4998])],
    );
    assert!(dynamic::validate_program(&full).is_ok()); // 2 + 1 + 9996 = 9999
    let excess = program(
        main.clone(),
        vec![function(0, vec![S::Print(E::None); 4999])],
    );
    assert!(dynamic::validate_program(&excess).is_err());
    let literals = vec![function(0, vec![S::Print(E::Text("x".repeat(600_000)))]); 2];
    assert!(dynamic::validate_program(&program(main, literals)).is_err());
}

#[test]
fn call_arguments_share_expression_depth_and_suite_limits() {
    let mut expression = E::None;
    for _ in 0..128 {
        expression = call(0, vec![expression]);
    }
    let functions = vec![function(1, vec![S::Return(E::Local(0))])];
    assert!(
        dynamic::validate_program(&program(
            vec![S::Print(expression.clone())],
            functions.clone()
        ))
        .is_ok()
    );
    assert!(
        dynamic::validate_program(&program(
            vec![S::Print(call(0, vec![expression]))],
            functions.clone()
        ))
        .is_err()
    );
    let mut body = S::Return(E::None);
    for _ in 0..65 {
        body = S::Group(vec![body]);
    }
    assert!(
        dynamic::validate_program(&program(
            vec![S::Print(E::None)],
            vec![function(0, vec![body])]
        ))
        .is_err()
    );
}

#[test]
fn direct_program_emission_is_deterministic_and_static() {
    let source = program(
        vec![S::Print(call(
            0,
            vec![E::Text("immutable-argument".into())],
        ))],
        vec![function(1, vec![S::Return(E::Local(0))])],
    );
    let a = dynamic::emit_program(&source).unwrap();
    assert_eq!(a, dynamic::emit_program(&source).unwrap());
    assert_eq!(u16::from_le_bytes(a[56..58].try_into().unwrap()), 2);
    assert_eq!(u32::from_le_bytes(a[68..72].try_into().unwrap()), 5);
    assert_eq!(
        u32::from_le_bytes(a[120..124].try_into().unwrap()),
        0x6474e551
    );
    assert_eq!(u32::from_le_bytes(a[124..128].try_into().unwrap()), 6);
}
