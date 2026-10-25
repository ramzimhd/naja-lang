//! Native value domains share one parser and suite model.
use naja_frontend::LiteralValue;
use naja_native::{self as fixed, Binary, Comparison, dynamic, hosted};

pub(crate) trait Values {
    type Expression;
    type Condition;
    type Statement;
    type Function;
    const HOSTED: bool;
    const DYNAMIC: bool = false;
    fn integer(text: String) -> Result<Self::Expression, String>;
    fn literal(_value: LiteralValue) -> Result<Self::Expression, String> {
        Err("text and bytes are unsupported in this explicit integer domain".into())
    }
    fn boolean(_value: bool) -> Result<Self::Expression, String> {
        Err("booleans are unsupported in this explicit integer domain".into())
    }
    fn none() -> Result<Self::Expression, String> {
        Err("None is unsupported in this explicit integer domain".into())
    }
    fn tuple(_elements: Vec<Self::Expression>) -> Result<Self::Expression, String> {
        Err("tuples are unsupported in this explicit integer domain".into())
    }
    fn list(_elements: Vec<Self::Expression>) -> Result<Self::Expression, String> {
        Err("lists are unsupported in this explicit integer domain".into())
    }
    fn set_index(
        _target: Self::Expression,
        _value: Self::Expression,
    ) -> Result<Self::Statement, String> {
        Err("indexed assignment is unsupported in this explicit integer domain".into())
    }
    fn local(slot: usize) -> Self::Expression;
    fn call(_index: usize, _arguments: Vec<Self::Expression>) -> Result<Self::Expression, String> {
        Err("function calls are unsupported in this explicit integer domain".into())
    }
    fn function(_parameters: usize, _body: Vec<Self::Statement>) -> Result<Self::Function, String> {
        Err("function definitions are unsupported in this explicit integer domain".into())
    }
    fn returned(_value: Self::Expression) -> Result<Self::Statement, String> {
        Err("return is unsupported in this explicit integer domain".into())
    }
    fn evaluate(_value: Self::Expression) -> Result<Self::Statement, String> {
        Err("call statements are unsupported in this explicit integer domain".into())
    }
    fn positive(value: Self::Expression) -> Self::Expression {
        value
    }
    fn require_integer(value: Self::Expression) -> Self::Expression {
        value
    }
    fn length(_value: Self::Expression) -> Result<Self::Expression, String> {
        Err("len is unsupported in this explicit integer domain".into())
    }
    fn index(
        _sequence: Self::Expression,
        _index: Self::Expression,
    ) -> Result<Self::Expression, String> {
        Err("indexing is unsupported in this explicit integer domain".into())
    }
    fn negate(value: Self::Expression) -> Self::Expression;
    fn boolean_not(_value: Self::Expression) -> Result<Self::Expression, String> {
        Err("not is unsupported in this explicit integer domain".into())
    }
    fn logical(
        _and: bool,
        _left: Self::Expression,
        _right: Self::Expression,
    ) -> Result<Self::Expression, String> {
        Err("short-circuit expressions are unsupported in this explicit integer domain".into())
    }
    fn comparison_chain(
        _first: Self::Expression,
        _rest: Vec<(Comparison, Self::Expression)>,
    ) -> Result<Self::Expression, String> {
        Err("comparison values are unsupported in this explicit integer domain".into())
    }
    fn truth(_value: Self::Expression) -> Result<Self::Condition, String> {
        Err("this explicit integer domain requires a comparison condition".into())
    }
    fn binary(op: Binary, left: Self::Expression, right: Self::Expression) -> Self::Expression;
    fn divrem(
        _remainder: bool,
        _left: Self::Expression,
        _right: Self::Expression,
    ) -> Result<Self::Expression, String> {
        Err("floor division and remainder are unsupported in this explicit integer domain".into())
    }
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
pub(crate) struct Dynamic;

macro_rules! domain {
    ($name:ident, $module:ident, $hosted:literal, $integer:expr) => {
        impl Values for $name {
            type Expression = $module::Expression;
            type Condition = $module::Condition;
            type Statement = $module::Statement;
            type Function = ();
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

impl Values for Dynamic {
    type Expression = dynamic::Expression;
    type Condition = dynamic::Expression;
    type Statement = dynamic::Statement;
    type Function = dynamic::Function;
    const HOSTED: bool = true;
    const DYNAMIC: bool = true;
    fn integer(text: String) -> Result<Self::Expression, String> {
        Ok(dynamic::Expression::Integer(text))
    }
    fn literal(value: LiteralValue) -> Result<Self::Expression, String> {
        Ok(match value {
            LiteralValue::Text(value) => dynamic::Expression::Text(value),
            LiteralValue::Bytes(value) => dynamic::Expression::Bytes(value),
        })
    }
    fn boolean(value: bool) -> Result<Self::Expression, String> {
        Ok(dynamic::Expression::Boolean(value))
    }
    fn none() -> Result<Self::Expression, String> {
        Ok(dynamic::Expression::None)
    }
    fn tuple(elements: Vec<Self::Expression>) -> Result<Self::Expression, String> {
        Ok(dynamic::Expression::Tuple(elements))
    }
    fn list(elements: Vec<Self::Expression>) -> Result<Self::Expression, String> {
        Ok(dynamic::Expression::List(elements))
    }
    fn set_index(
        target: Self::Expression,
        value: Self::Expression,
    ) -> Result<Self::Statement, String> {
        let dynamic::Expression::Index(sequence, index) = target else {
            return Err("this assignment requires a single subscript target; unpacking and other targets are not implemented".into());
        };
        Ok(dynamic::Statement::SetIndex {
            sequence: *sequence,
            index: *index,
            value,
        })
    }
    fn local(slot: usize) -> Self::Expression {
        dynamic::Expression::Local(slot)
    }
    fn call(index: usize, arguments: Vec<Self::Expression>) -> Result<Self::Expression, String> {
        Ok(dynamic::Expression::Call(index, arguments))
    }
    fn function(parameters: usize, body: Vec<Self::Statement>) -> Result<Self::Function, String> {
        Ok(dynamic::Function { parameters, body })
    }
    fn returned(value: Self::Expression) -> Result<Self::Statement, String> {
        Ok(dynamic::Statement::Return(value))
    }
    fn evaluate(value: Self::Expression) -> Result<Self::Statement, String> {
        Ok(dynamic::Statement::Evaluate(value))
    }
    fn positive(value: Self::Expression) -> Self::Expression {
        dynamic::Expression::Positive(Box::new(value))
    }
    fn require_integer(value: Self::Expression) -> Self::Expression {
        dynamic::Expression::RequireInteger(Box::new(value))
    }
    fn length(value: Self::Expression) -> Result<Self::Expression, String> {
        Ok(dynamic::Expression::Len(Box::new(value)))
    }
    fn index(
        sequence: Self::Expression,
        index: Self::Expression,
    ) -> Result<Self::Expression, String> {
        Ok(dynamic::Expression::Index(
            Box::new(sequence),
            Box::new(index),
        ))
    }
    fn negate(value: Self::Expression) -> Self::Expression {
        dynamic::Expression::Negate(Box::new(value))
    }
    fn boolean_not(value: Self::Expression) -> Result<Self::Expression, String> {
        Ok(dynamic::Expression::Not(Box::new(value)))
    }
    fn logical(
        and: bool,
        left: Self::Expression,
        right: Self::Expression,
    ) -> Result<Self::Expression, String> {
        Ok(if and {
            dynamic::Expression::And(Box::new(left), Box::new(right))
        } else {
            dynamic::Expression::Or(Box::new(left), Box::new(right))
        })
    }
    fn comparison_chain(
        first: Self::Expression,
        rest: Vec<(Comparison, Self::Expression)>,
    ) -> Result<Self::Expression, String> {
        Ok(dynamic::Expression::CompareChain(Box::new(first), rest))
    }
    fn truth(value: Self::Expression) -> Result<Self::Condition, String> {
        Ok(value)
    }
    fn binary(op: Binary, left: Self::Expression, right: Self::Expression) -> Self::Expression {
        dynamic::Expression::Binary(op, Box::new(left), Box::new(right))
    }
    fn divrem(
        remainder: bool,
        left: Self::Expression,
        right: Self::Expression,
    ) -> Result<Self::Expression, String> {
        Ok(if remainder {
            dynamic::Expression::Modulo(Box::new(left), Box::new(right))
        } else {
            dynamic::Expression::FloorDivide(Box::new(left), Box::new(right))
        })
    }
    fn height(value: &Self::Expression) -> usize {
        use dynamic::Expression::*;
        match value {
            Integer(_) | Text(_) | Bytes(_) | Boolean(_) | None | Local(_) => 1,
            Negate(value) | Positive(value) | RequireInteger(value) | Len(value) | Not(value) => {
                1 + Self::height(value)
            }
            Binary(_, left, right)
            | FloorDivide(left, right)
            | Modulo(left, right)
            | Index(left, right)
            | Compare(_, left, right)
            | And(left, right)
            | Or(left, right) => 1 + Self::height(left).max(Self::height(right)),
            CompareChain(first, rest) => {
                1 + rest
                    .iter()
                    .map(|(_, value)| Self::height(value))
                    .fold(Self::height(first), usize::max)
            }
            Call(_, arguments) | Tuple(arguments) | List(arguments) => {
                1 + arguments.iter().map(Self::height).max().unwrap_or(0)
            }
        }
    }
    fn condition(
        left: Self::Expression,
        comparison: Comparison,
        right: Self::Expression,
    ) -> Self::Condition {
        dynamic::Expression::Compare(comparison, Box::new(left), Box::new(right))
    }
    fn assign(slot: usize, value: Self::Expression) -> Self::Statement {
        dynamic::Statement::Assign(slot, value)
    }
    fn print(value: Self::Expression) -> Self::Statement {
        dynamic::Statement::Print(value)
    }
    fn group(body: Vec<Self::Statement>) -> Self::Statement {
        dynamic::Statement::Group(body)
    }
    fn assertion(condition: Self::Condition) -> Self::Statement {
        dynamic::Statement::Assert(condition)
    }
    fn conditional(
        condition: Self::Condition,
        yes: Vec<Self::Statement>,
        no: Vec<Self::Statement>,
    ) -> Self::Statement {
        dynamic::Statement::If(condition, yes, no)
    }
    fn while_loop(condition: Self::Condition, body: Vec<Self::Statement>) -> Self::Statement {
        dynamic::Statement::While(condition, body)
    }
}
