use std::process::Command;

use ark_ff::{BigInteger, PrimeField};

use amoeba_crypto::{fr_from_decimal, fr_to_canonical_decimal};
use amoeba_types::Roots;

use crate::config::Config;

pub fn field_decimal_to_hex(decimal: &str) -> Result<String, String> {
    let fr = fr_from_decimal(decimal);
    let bytes = fr.into_bigint().to_bytes_be();
    let mut padded = [0u8; 32];
    padded[32 - bytes.len()..].copy_from_slice(&bytes);
    Ok(hex::encode(&padded))
}

pub fn publish_roots(cfg: &Config, roots: &Roots, corridor_id: u32) -> Result<String, String> {
    let compliance = cfg
        .compliance_id
        .as_ref()
        .ok_or("COMPLIANCE_CONTRACT_ID not set")?;
    let source = cfg
        .publish_source_key()
        .ok_or("ADMIN_SECRET_KEY or ISSUER_SECRET_KEY not set")?;
    let issuer = cfg
        .issuer_public_key
        .as_ref()
        .ok_or("ISSUER_PUBLIC_KEY not set")?;

    let merkle = field_decimal_to_hex(&roots.merkle_root)?;
    let sanctions = field_decimal_to_hex(&roots.sanctions_root)?;
    let jurisdiction = field_decimal_to_hex(&roots.jurisdiction_root)?;
    let source_j = field_decimal_to_hex(&roots.source_jurisdiction_root)?;
    let dest = field_decimal_to_hex(&roots.dest_address_root)?;
    let corridor_hash = field_decimal_to_hex(&roots.corridor_config_hash)?;

    let network = if cfg.network_passphrase.contains("Test SDF") {
        "testnet"
    } else {
        "local"
    };

    let register_issuer = Command::new("stellar")
        .args([
            "contract",
            "invoke",
            "--id",
            compliance,
            "--source-account",
            &source,
            "--network",
            network,
            "--",
            "register_issuer",
            "--issuer",
            issuer,
            "--merkle_root",
            &merkle,
            "--sanctions_root",
            &sanctions,
            "--jurisdiction_root",
            &jurisdiction,
        ])
        .output()
        .map_err(|e| format!("stellar invoke failed: {e}"))?;

    if !register_issuer.status.success() {
        let stderr = String::from_utf8_lossy(&register_issuer.stderr);
        if !stderr.contains("AlreadyExists") && !stderr.contains("already") {
            return Err(format!("register_issuer failed: {stderr}"));
        }
        let update = Command::new("stellar")
            .args([
                "contract",
                "invoke",
                "--id",
                compliance,
                "--source-account",
                &source,
                "--network",
                network,
                "--",
                "update_issuer_root",
                "--issuer",
                issuer,
                "--merkle_root",
                &merkle,
                "--sanctions_root",
                &sanctions,
                "--jurisdiction_root",
                &jurisdiction,
            ])
            .output()
            .map_err(|e| format!("stellar invoke failed: {e}"))?;
        if !update.status.success() {
            return Err(format!(
                "update_issuer_root failed: {}",
                String::from_utf8_lossy(&update.stderr)
            ));
        }
    }

    let register_corridor = Command::new("stellar")
        .args([
            "contract",
            "invoke",
            "--id",
            compliance,
            "--source-account",
            &source,
            "--network",
            network,
            "--",
            "register_corridor",
            "--corridor_id",
            &corridor_id.to_string(),
            "--source_jurisdiction_root",
            &source_j,
            "--dest_address_root",
            &dest,
            "--corridor_config_hash",
            &corridor_hash,
        ])
        .output()
        .map_err(|e| format!("stellar invoke failed: {e}"))?;

    if !register_corridor.status.success() {
        let stderr = String::from_utf8_lossy(&register_corridor.stderr);
        if !stderr.contains("AlreadyExists") && !stderr.contains("already") {
            return Err(format!("register_corridor failed: {stderr}"));
        }
        let update = Command::new("stellar")
            .args([
                "contract",
                "invoke",
                "--id",
                compliance,
                "--source-account",
                &source,
                "--network",
                network,
                "--",
                "update_corridor",
                "--corridor_id",
                &corridor_id.to_string(),
                "--source_jurisdiction_root",
                &source_j,
                "--dest_address_root",
                &dest,
                "--corridor_config_hash",
                &corridor_hash,
                "--enabled",
                "true",
            ])
            .output()
            .map_err(|e| format!("stellar invoke failed: {e}"))?;
        if !update.status.success() {
            return Err(format!(
                "update_corridor failed: {}",
                String::from_utf8_lossy(&update.stderr)
            ));
        }
    }

    Ok(format!(
        "published roots for issuer {issuer} corridor {corridor_id} (merkle={})",
        fr_to_canonical_decimal(fr_from_decimal(&roots.merkle_root))
    ))
}

#[allow(dead_code)]
pub fn stellar_available() -> bool {
    Command::new("stellar")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

// hex helper without extra dep in lib — use simple hex encode
mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    }
}
