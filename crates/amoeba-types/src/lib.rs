include!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../bindings/generated/public_inputs.rs"
));

pub mod proof_package;
pub mod public_inputs;

pub use proof_package::*;
pub use public_inputs::{normalize_field, public_inputs_from_roots, PublicInputsMap};
