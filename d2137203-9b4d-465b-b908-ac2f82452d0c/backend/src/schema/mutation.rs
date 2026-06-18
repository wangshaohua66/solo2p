use juniper::{graphql_object, FieldResult};
use crate::AppState;

pub struct Mutation;

#[graphql_object(context = AppState)]
impl Mutation {
    fn noop() -> String {
        "noop".to_string()
    }
}
