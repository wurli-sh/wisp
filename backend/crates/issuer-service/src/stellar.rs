use std::process::Command;

use ark_ff::{BigInteger, PrimeField};

use amoeba_crypto::{fr_from_decimal, fr_to_canonical_decimal};
use amoeba_types::Roots;

use crate::config::Config;

fn network_alias(cfg: &Config) -> &'static str {
    if cfg.network_passphrase.contains("Test SDF") {
        "testnet"
    } else {
        "local"
    }
}

fn stellar_command(cfg: &Config) -> Command {
    let mut cmd = Command::new("stellar");
    cmd.env("STELLAR_NETWORK_PASSPHRASE", &cfg.network_passphrase)
        .env("STELLAR_RPC_URL", &cfg.rpc_url);
    cmd
}

fn push_invoke_prefix(args: &mut Vec<String>, cfg: &Config, compliance: &str, source: &str) {
    args.extend([
        "contract".into(),
        "invoke".into(),
        "--id".into(),
        compliance.to_string(),
        "--source-account".into(),
        source.to_string(),
        "--network".into(),
        network_alias(cfg).into(),
        "--network-passphrase".into(),
        cfg.network_passphrase.clone(),
        "--rpc-url".into(),
        cfg.rpc_url.clone(),
    ]);
}

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
        .publish_source_account()
        .ok_or("Set PUBLISH_SOURCE_ACCOUNT / SOURCE (e.g. amoeba-admin) or ADMIN_SECRET_KEY / ISSUER_SECRET_KEY")?;
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

    let mut register_issuer_args = Vec::new();
    push_invoke_prefix(&mut register_issuer_args, cfg, compliance, &source);
    register_issuer_args.extend([
        "--".into(),
        "register_issuer".into(),
        "--issuer".into(),
        issuer.clone(),
        "--merkle_root".into(),
        merkle.clone(),
        "--sanctions_root".into(),
        sanctions.clone(),
        "--jurisdiction_root".into(),
        jurisdiction.clone(),
    ]);
    let register_issuer = stellar_command(cfg)
        .args(&register_issuer_args)
        .output()
        .map_err(|e| format!("stellar invoke failed: {e}"))?;

    if !register_issuer.status.success() {
        let stderr = String::from_utf8_lossy(&register_issuer.stderr);
        if !stderr.contains("AlreadyExists") && !stderr.contains("already") {
            return Err(format!("register_issuer failed: {stderr}"));
        }
        let auth = cfg.publish_auth_key().ok_or_else(|| {
            if cfg.admin_signs_publish() {
                "ADMIN_PUBLIC_KEY required when admin signs update_issuer_root (--auth must match signer)"
                    .to_string()
            } else {
                "ISSUER_PUBLIC_KEY required when issuer signs update_issuer_root".to_string()
            }
        })?;
        let mut update_args = Vec::new();
        push_invoke_prefix(&mut update_args, cfg, compliance, &source);
        update_args.extend([
            "--".into(),
            "update_issuer_root".into(),
            "--issuer".into(),
            issuer.clone(),
            "--merkle_root".into(),
            merkle.clone(),
            "--sanctions_root".into(),
            sanctions.clone(),
            "--jurisdiction_root".into(),
            jurisdiction.clone(),
            "--auth".into(),
            auth,
        ]);
        let update = stellar_command(cfg)
            .args(&update_args)
            .output()
            .map_err(|e| format!("stellar invoke failed: {e}"))?;
        if !update.status.success() {
            return Err(format!(
                "update_issuer_root failed: {}",
                String::from_utf8_lossy(&update.stderr)
            ));
        }
    }

    let mut register_corridor_args = Vec::new();
    push_invoke_prefix(&mut register_corridor_args, cfg, compliance, &source);
    register_corridor_args.extend([
        "--".into(),
        "register_corridor".into(),
        "--corridor_id".into(),
        corridor_id.to_string(),
        "--source_jurisdiction_root".into(),
        source_j.clone(),
        "--dest_address_root".into(),
        dest.clone(),
        "--corridor_config_hash".into(),
        corridor_hash.clone(),
    ]);
    let register_corridor = stellar_command(cfg)
        .args(&register_corridor_args)
        .output()
        .map_err(|e| format!("stellar invoke failed: {e}"))?;

    if !register_corridor.status.success() {
        let stderr = String::from_utf8_lossy(&register_corridor.stderr);
        if !stderr.contains("AlreadyExists") && !stderr.contains("already") {
            return Err(format!("register_corridor failed: {stderr}"));
        }
        let mut update_corridor_args = Vec::new();
        push_invoke_prefix(&mut update_corridor_args, cfg, compliance, &source);
        update_corridor_args.extend([
            "--".into(),
            "update_corridor".into(),
            "--corridor_id".into(),
            corridor_id.to_string(),
            "--source_jurisdiction_root".into(),
            source_j,
            "--dest_address_root".into(),
            dest,
            "--corridor_config_hash".into(),
            corridor_hash,
            "--enabled".into(),
            "true".into(),
        ]);
        let update = stellar_command(cfg)
            .args(&update_corridor_args)
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
