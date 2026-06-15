#!/usr/bin/env bash
# Re-apply Amoeba-specific fixes after soroban-verifier-gen overwrites the crate.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$ROOT/contracts/verifier/src/lib.rs"
VK="$ROOT/contracts/verifier/src/vk.rs"
CARGO="$ROOT/contracts/verifier/Cargo.toml"
TEST="$ROOT/contracts/verifier/src/test.rs"

python3 <<PY
from pathlib import Path

lib = Path("$LIB")
text = lib.read_text()

text = text.replace("Bn254Fr", "Fr")
if "crypto::bn254::{Bn254G1Affine" in text and ", Fr," not in text.split("};")[0]:
    text = text.replace(
        "crypto::bn254::{Bn254G1Affine, Bn254G2Affine,",
        "crypto::bn254::{Bn254G1Affine, Bn254G2Affine, Fr,",
    )
if "BytesN" not in text.split("use soroban_sdk")[1].split("};")[0]:
    text = text.replace("Env, Vec,", "BytesN, Env, Vec,")

if "fn vk_hash" not in text:
    marker = "        Ok(bn.pairing_check(vp1, vp2))\n    }\n}"
    insert = """        Ok(bn.pairing_check(vp1, vp2))
    }

    /// SHA-256 digest of the embedded verification key bytes (circuit identity).
    pub fn vk_hash(env: Env) -> BytesN<32> {
        vk::vk_digest(&env)
    }
}"""
    if marker in text:
        text = text.replace(marker, insert)
    else:
        raise SystemExit("Could not locate verify_proof impl end for vk_hash patch")

if "#[cfg(test)]" not in text:
    text = text.rstrip() + "\n\n#[cfg(test)]\nmod test;\n"

lib.write_text(text)
PY

python3 <<PY
from pathlib import Path

lib = Path("$LIB")
vk_path = Path("$VK")
text = lib.read_text()

if "// AUTO-GENERATED VK BYTES" not in text:
    raise SystemExit("Generated lib.rs is missing VK bytes block")

start = text.index("// AUTO-GENERATED VK BYTES")
end = text.index("\n#[contract]\npub struct Groth16Verifier")
vk_block = text[start:end].rstrip()
vk_block = vk_block.replace(
    "fn vk(env: &Env) -> VerificationKey",
    "pub(crate) fn verification_key(env: &Env) -> VerificationKey",
)

header = """#![allow(clippy::unreadable_literal)]

use soroban_sdk::{
    crypto::bn254::{
        Bn254G1Affine, Bn254G2Affine, BN254_G1_SERIALIZED_SIZE, BN254_G2_SERIALIZED_SIZE,
    },
    Bytes, BytesN, Env, Vec,
};

use super::VerificationKey;

"""
footer = """

pub(crate) fn vk_digest(env: &Env) -> BytesN<32> {
    let mut bytes = Bytes::new(env);
    bytes.extend_from_slice(&VK_ALPHA);
    bytes.extend_from_slice(&VK_BETA);
    bytes.extend_from_slice(&VK_GAMMA);
    bytes.extend_from_slice(&VK_DELTA);
    for p in VK_IC.iter() {
        bytes.extend_from_slice(p);
    }
    env.crypto().sha256(&bytes).into()
}
"""
vk_path.write_text(header + vk_block + footer)

new_lib = text[:start] + "mod vk;\n\n" + text[end:]
new_lib = new_lib.replace("let vk = vk(&env);", "let vk = vk::verification_key(&env);")
if "mod vk;" not in new_lib:
    raise SystemExit("failed to inject mod vk")
lib.write_text(new_lib)
print(f"Split VK into {vk_path}")
PY

cat > "$CARGO" <<'EOF'
[package]
name = "verifier"
version = "0.1.0"
edition = "2021"
publish = false

[lib]
crate-type = ["lib", "cdylib"]
doctest = false

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
ark-bn254 = "0.6"
ark-ff = "0.6"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
EOF

if [[ ! -f "$TEST" ]]; then
  echo "WARN: $TEST missing — keep the existing compliance fixture tests in verifier."
fi

echo "Patched verifier for Amoeba (SDK 25 workspace, Fr, vk.rs, vk_hash)."
