use naja_native::{
    Comparison,
    dynamic::{self, Expression as E, Relation, Statement as S},
};

#[test]
fn literal_bounds_count_source_entries_including_duplicates() {
    for n in [0, 128] {
        assert!(dynamic::validate(&[S::Evaluate(E::Dict(vec![(E::None, E::None); n]))]).is_ok());
        assert!(dynamic::validate(&[S::Evaluate(E::Set(vec![E::None; n]))]).is_ok());
    }
    assert!(dynamic::validate(&[S::Evaluate(E::Dict(vec![(E::None, E::None); 129]))]).is_err());
    assert!(dynamic::validate(&[S::Evaluate(E::Set(vec![E::None; 129]))]).is_err());
}

#[test]
fn mapping_operands_validate_including_skipped_branches_and_values() {
    for expression in [
        E::Dict(vec![(E::Local(0), E::None)]),
        E::Dict(vec![(E::None, E::Local(0))]),
        E::Set(vec![E::Local(0)]),
        E::DictKeys(Box::new(E::Local(0))),
        E::Contains(Box::new(E::Local(0)), Box::new(E::None)),
        E::Contains(Box::new(E::None), Box::new(E::Local(0))),
        E::RelationChain(Box::new(E::None), vec![(Relation::In, E::Local(0))]),
    ] {
        assert!(
            dynamic::validate(&[S::Evaluate(E::And(
                Box::new(E::Boolean(false)),
                Box::new(expression)
            ))])
            .is_err()
        );
    }
}

#[test]
fn relation_chains_preserve_the_global_operation_and_depth_limits() {
    for relations in [vec![], vec![(Relation::In, E::None); 129]] {
        assert!(
            dynamic::validate(&[S::Evaluate(E::RelationChain(Box::new(E::None), relations))])
                .is_err()
        );
    }
    assert!(
        dynamic::validate(&[S::Evaluate(E::RelationChain(
            Box::new(E::None),
            vec![(Relation::Compare(Comparison::Equal), E::None); 128]
        ))])
        .is_ok()
    );
    let chain = E::RelationChain(Box::new(E::None), vec![(Relation::NotIn, E::None); 2]);
    assert!(dynamic::validate(&vec![S::Evaluate(chain); 1667]).is_err());
    let mut value = E::None;
    for _ in 0..128 {
        value = E::DictKeys(Box::new(value));
    }
    assert!(dynamic::validate(&[S::Evaluate(value.clone())]).is_ok());
    assert!(dynamic::validate(&[S::Evaluate(E::DictKeys(Box::new(value)))]).is_err());
}

#[test]
fn mappings_share_literal_and_node_accounting_and_emit_deterministically() {
    assert!(
        dynamic::validate(&[S::Evaluate(E::Dict(vec![(
            E::Text("x".repeat(1_048_577)),
            E::None
        )]))])
        .is_err()
    );
    assert!(dynamic::validate(&vec![S::Evaluate(E::Dict(vec![(E::None, E::None)])); 2500]).is_ok());
    assert!(
        dynamic::validate(&vec![S::Evaluate(E::Dict(vec![(E::None, E::None)])); 2501]).is_err()
    );
    let program = [
        S::Assign(0, E::Dict(vec![(E::Integer("1".into()), E::Boolean(true))])),
        S::Print(E::Contains(
            Box::new(E::Boolean(true)),
            Box::new(E::Local(0)),
        )),
    ];
    assert_eq!(
        dynamic::emit_elf(&program).unwrap(),
        dynamic::emit_elf(&program).unwrap()
    );
}
