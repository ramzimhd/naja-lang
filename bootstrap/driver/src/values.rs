//! Two explicit value domains share one parser and suite model.
use naja_native::{self as fixed, Binary, Comparison, hosted};

pub(crate) trait Values {
    type Expression;
    type Condition;
    type Statement;
    const HOSTED: bool;
    fn integer(text: String) -> Result<Self::Expression, String>;
    fn local(slot: usize) -> Self::Expression;
    fn negate(value: Self::Expression) -> Self::Expression;
    fn binary(op: Binary, left: Self::Expression, right: Self::Expression) -> Self::Expression;
    fn height(value: &Self::Expression) -> usize;
    fn condition(
        left: Self::Expression,
        comparison: Comparison,
        right: Self::Expression,
    ) -> Self::Condition;
    fn assign(slot: usize, value: Self::Expression) -> Self::Statement;
    fn print(value: Self::Expression) -> Self::Statement;
    fn group(body: Vec<Self::Statement>) -> Self::Statement;
    fn assertion(condition: Self::Condition) -> Self::Statement;
    fn conditional(
        condition: Self::Condition,
        yes: Vec<Self::Statement>,
        no: Vec<Self::Statement>,
    ) -> Self::Statement;
    fn while_loop(condition: Self::Condition, body: Vec<Self::Statement>) -> Self::Statement;
}

pub(crate) struct Fixed;
pub(crate) struct Hosted;

macro_rules! domain {
    ($name:ident, $module:ident, $hosted:literal, $integer:expr) => {
        impl Values for $name {
            type Expression = $module::Expression;
            type Condition = $module::Condition;
            type Statement = $module::Statement;
            const HOSTED: bool = $hosted;
            fn integer(text: String) -> Result<Self::Expression, String> {
                $integer(text)
            }
            fn local(slot: usize) -> Self::Expression {
                $module::Expression::Local(slot)
            }
            fn negate(value: Self::Expression) -> Self::Expression {
                $module::Expression::Negate(Box::new(value))
            }
            fn binary(
                op: Binary,
                left: Self::Expression,
                right: Self::Expression,
            ) -> Self::Expression {
                $module::Expression::Binary(op, Box::new(left), Box::new(right))
            }
            fn height(value: &Self::Expression) -> usize {
                match value {
                    $module::Expression::Integer(_) | $module::Expression::Local(_) => 1,
                    $module::Expression::Negate(inner) => 1 + Self::height(inner),
                    $module::Expression::Binary(_, left, right) => {
                        1 + Self::height(left).max(Self::height(right))
                    }
                }
            }
            fn condition(
                left: Self::Expression,
                comparison: Comparison,
                right: Self::Expression,
            ) -> Self::Condition {
                $module::Condition {
                    left,
                    comparison,
                    right,
                }
            }
            fn assign(slot: usize, value: Self::Expression) -> Self::Statement {
                $module::Statement::Assign(slot, value)
            }
            fn print(value: Self::Expression) -> Self::Statement {
                $module::Statement::Print(value)
            }
            fn group(body: Vec<Self::Statement>) -> Self::Statement {
                $module::Statement::Group(body)
            }
            fn assertion(condition: Self::Condition) -> Self::Statement {
                $module::Statement::Assert(condition)
            }
            fn conditional(
                condition: Self::Condition,
                yes: Vec<Self::Statement>,
                no: Vec<Self::Statement>,
            ) -> Self::Statement {
                $module::Statement::If(condition, yes, no)
            }
            fn while_loop(
                condition: Self::Condition,
                body: Vec<Self::Statement>,
            ) -> Self::Statement {
                $module::Statement::While(condition, body)
            }
        }
    };
}
domain!(Fixed, fixed, false, |text: String| text
    .parse::<i64>()
    .map(fixed::Expression::Integer)
    .map_err(|_| {
        "literal is outside explicit i64 range; hosted integers are never implicitly narrowed"
            .into()
    }));
domain!(Hosted, hosted, true, |text: String| Ok(
    hosted::Expression::Integer(text)
));
