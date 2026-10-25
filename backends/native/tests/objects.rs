use naja_native::dynamic::{
    self, Class, Expression as E, Function, Method, ObjectProgram, Statement as S,
};

fn program(value: E) -> ObjectProgram {
    ObjectProgram {
        body: vec![S::Evaluate(value)],
        functions: vec![],
        classes: vec![Class { methods: vec![] }],
    }
}

#[test]
fn additive_program_preserves_legacy_validation_and_checks_class_metadata() {
    assert!(dynamic::validate(&[S::Evaluate(E::Construct(0, vec![]))]).is_err());
    assert!(dynamic::validate_object_program(&program(E::Construct(0, vec![]))).is_ok());
    assert!(dynamic::validate_object_program(&program(E::Construct(1, vec![]))).is_err());
    assert!(dynamic::validate_object_program(&program(E::Construct(0, vec![E::None]))).is_err());
    let mut p = program(E::None);
    p.classes = vec![Class { methods: vec![] }; 128];
    assert!(dynamic::validate_object_program(&p).is_ok());
    p.classes.push(Class { methods: vec![] });
    assert!(dynamic::validate_object_program(&p).is_err());
    p.classes = vec![Class {
        methods: vec![Method {
            name: "m".into(),
            function: 0,
        }],
    }];
    assert!(dynamic::validate_object_program(&p).is_err());
    p.functions.push(Function {
        parameters: 0,
        body: vec![],
    });
    assert!(dynamic::validate_object_program(&p).is_err());
    p.functions[0].parameters = 1;
    assert!(dynamic::validate_object_program(&p).is_ok());
    let duplicate = p.classes[0].methods[0].clone();
    p.classes[0].methods.push(duplicate);
    assert!(dynamic::validate_object_program(&p).is_err());
}

#[test]
fn names_methods_and_initializers_are_bounded_and_exact() {
    for name in ["".into(), "x\0y".into(), "x".repeat(257), "__bool__".into()] {
        assert!(
            dynamic::validate_object_program(&program(E::GetAttribute(Box::new(E::None), name)))
                .is_err()
        );
    }
    for name in [
        "x".repeat(256),
        "é".repeat(128),
        "字段".into(),
        "e\u{301}".into(),
    ] {
        assert!(
            dynamic::validate_object_program(&program(E::GetAttribute(Box::new(E::None), name)))
                .is_ok()
        );
    }
    let mut p = program(E::Construct(0, vec![E::None]));
    p.functions.push(Function {
        parameters: 2,
        body: vec![S::Return(E::None)],
    });
    p.classes[0].methods.push(Method {
        name: "__init__".into(),
        function: 0,
    });
    assert!(dynamic::validate_object_program(&p).is_ok());
    p.functions[0].parameters = 1;
    assert!(dynamic::validate_object_program(&p).is_err());
    let mut p = program(E::None);
    p.functions.push(Function {
        parameters: 1,
        body: vec![],
    });
    p.classes[0].methods = (0..128)
        .map(|i| Method {
            name: format!("m{i}"),
            function: 0,
        })
        .collect();
    assert!(dynamic::validate_object_program(&p).is_ok());
    p.classes[0].methods.push(Method {
        name: "extra".into(),
        function: 0,
    });
    assert!(dynamic::validate_object_program(&p).is_err());
}

#[test]
fn every_object_tree_validates_even_when_unused_or_skipped() {
    for value in [
        E::Construct(0, vec![E::Local(0)]),
        E::GetAttribute(Box::new(E::Local(0)), "x".into()),
        E::MethodCall(Box::new(E::None), "x".into(), vec![E::Local(0)]),
    ] {
        let mut p = program(E::And(Box::new(E::Boolean(false)), Box::new(value.clone())));
        assert!(dynamic::validate_object_program(&p).is_err());
        p.body = vec![S::Evaluate(E::None)];
        p.functions.push(Function {
            parameters: 0,
            body: vec![S::Return(E::None), S::Evaluate(value)],
        });
        assert!(dynamic::validate_object_program(&p).is_err());
    }
    for statement in [
        S::SetAttribute {
            object: E::Local(0),
            name: "x".into(),
            value: E::None,
        },
        S::SetAttribute {
            object: E::None,
            name: "x".into(),
            value: E::Local(0),
        },
    ] {
        let mut p = program(E::None);
        p.body
            .push(S::If(E::Boolean(false), vec![statement], vec![]));
        assert!(dynamic::validate_object_program(&p).is_err());
    }
}

#[test]
fn object_ir_shares_global_node_depth_name_and_literal_limits() {
    let mut value = E::None;
    for _ in 0..128 {
        value = E::GetAttribute(Box::new(value), "x".into());
    }
    assert!(dynamic::validate_object_program(&program(value.clone())).is_ok());
    assert!(
        dynamic::validate_object_program(&program(E::GetAttribute(Box::new(value), "x".into())))
            .is_err()
    );
    let mut p = program(E::None);
    p.body = (0..1024)
        .map(|i| S::Evaluate(E::GetAttribute(Box::new(E::None), format!("a{i}"))))
        .collect();
    assert!(dynamic::validate_object_program(&p).is_ok());
    p.body.push(S::Evaluate(E::GetAttribute(
        Box::new(E::None),
        "new".into(),
    )));
    assert!(dynamic::validate_object_program(&p).is_err());
    p.body = vec![
        S::SetAttribute {
            object: E::None,
            name: "x".into(),
            value: E::None
        };
        3333
    ];
    assert!(dynamic::validate_object_program(&p).is_ok()); // One class also consumes a node.
    p.body.push(S::Evaluate(E::None));
    assert!(dynamic::validate_object_program(&p).is_err());
    p.body = vec![S::Evaluate(E::GetAttribute(
        Box::new(E::Text("x".repeat(1_048_576))),
        "x".into(),
    ))];
    assert!(dynamic::validate_object_program(&p).is_err());
    assert!(
        dynamic::validate_object_program(&program(E::MethodCall(
            Box::new(E::None),
            "x".into(),
            vec![E::None; 128]
        )))
        .is_err()
    );
}
