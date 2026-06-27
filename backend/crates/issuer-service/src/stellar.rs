use std::{
    process::{Command, Output},
    thread,
    time::Duration,
};

use ark_ff::{BigInteger, PrimeField};

use wisp_crypto::{fr_from_decimal, fr_to_canonical_decimal};
use wisp_types::Roots;

use crate::config::Config;
use crate::log_util::{short_key, short_root};

fn network_alias(cfg: &Config) -> &'static str {
    if cfg.network_passphrase.contains("Test SDF") {
        "testnet"
    } else {
        "local"
    }
}

fn stellar_command(cfg: &Config) -> Command {
    let bin = std::env::var("STELLAR_BIN").unwrap_or_else(|_| {
        if std::path::Path::new("/usr/local/bin/stellar").is_file() {
            "/usr/local/bin/stellar".into()
        } else {
            "stellar".into()
        }
    });
    let mut cmd = Command::new(bin);
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

fn looks_like_v1_issuer_registry(output: &str) -> bool {
    output.contains("unexpected argument '--metadata_uri'")
        || output.contains("Usage: register_issuer --issuer <Address>")
}

fn invoke_output(status: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&status.stderr);
    let stdout = String::from_utf8_lossy(&status.stdout);
    if stderr.is_empty() {
        stdout.into_owned()
    } else if stdout.is_empty() {
        stderr.into_owned()
    } else {
        format!("{stderr}{stdout}")
    }
}

fn contract_error_code(output: &str, code: u32) -> bool {
    output.contains(&format!("Error(Contract, #{code})"))
}

fn is_bad_sequence(output: &str) -> bool {
    output.contains("TxBadSeq") || output.contains("tx_bad_seq")
}

fn invoke_with_sequence_retry(cfg: &Config, args: &[String]) -> Result<Output, String> {
    const MAX_ATTEMPTS: u32 = 3;
    for attempt in 1..=MAX_ATTEMPTS {
        let output = stellar_command(cfg)
            .args(args)
            .output()
            .map_err(|e| format!("stellar invoke failed: {e}"))?;
        if output.status.success() || !is_bad_sequence(&invoke_output(&output)) {
            return Ok(output);
        }
        if attempt < MAX_ATTEMPTS {
            tracing::warn!(
                attempt,
                max_attempts = MAX_ATTEMPTS,
                "stellar invoke returned TxBadSeq; retrying with a fresh account sequence"
            );
            thread::sleep(Duration::from_secs(u64::from(attempt)));
        } else {
            return Ok(output);
        }
    }
    unreachable!("sequence retry loop always returns")
}

fn is_already_registered(output: &str) -> bool {
    output.contains("AlreadyRegistered") || contract_error_code(output, 20)
}

fn is_corridor_already_exists(output: &str) -> bool {
    output.contains("CorridorAlreadyExists") || contract_error_code(output, 21)
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
        .ok_or("Set PUBLISH_SOURCE_ACCOUNT / SOURCE or ISSUER_SECRET_KEY for issuer-authenticated v2 publishing")?;
    let issuer = cfg
        .issuer_public_key
        .as_ref()
        .ok_or("ISSUER_PUBLIC_KEY not set")?;
    let metadata_uri = cfg.metadata_uri();

    tracing::info!(
        compliance = %compliance,
        issuer = %short_key(issuer),
        source = %source,
        corridor_id,
        "on-chain publish: start"
    );

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
        "--metadata_uri".into(),
        metadata_uri,
    ]);
    let register_issuer = invoke_with_sequence_retry(cfg, &register_issuer_args)?;
    if !register_issuer.status.success() {
        let output = invoke_output(&register_issuer);
        if looks_like_v1_issuer_registry(&output) {
            return Err(
                "register_issuer failed against an old v1 compliance contract ABI. \
Redeploy the compliance contract with the v2 initialize signature, update COMPLIANCE_CONTRACT_ID, then retry publishing roots."
                    .into(),
            );
        }
        if !is_already_registered(&output) {
            return Err(format!("register_issuer failed: {output}"));
        }
        tracing::info!("on-chain publish: register_issuer already registered");
    } else {
        tracing::info!("on-chain publish: register_issuer ok");
    }

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
    ]);
    let update = invoke_with_sequence_retry(cfg, &update_args)?;
    if !update.status.success() {
        return Err(format!(
            "update_issuer_root failed: {}",
            invoke_output(&update)
        ));
    }
    tracing::info!(
        merkle = %short_root(&merkle),
        "on-chain publish: update_issuer_root ok"
    );

    let mut register_corridor_args = Vec::new();
    push_invoke_prefix(&mut register_corridor_args, cfg, compliance, &source);
    register_corridor_args.extend([
        "--".into(),
        "register_corridor".into(),
        "--issuer".into(),
        issuer.clone(),
        "--corridor_id".into(),
        corridor_id.to_string(),
        "--source_jurisdiction_root".into(),
        source_j.clone(),
        "--dest_address_root".into(),
        dest.clone(),
        "--corridor_config_hash".into(),
        corridor_hash.clone(),
    ]);
    let register_corridor = invoke_with_sequence_retry(cfg, &register_corridor_args)?;

    if !register_corridor.status.success() {
        let output = invoke_output(&register_corridor);
        if !is_corridor_already_exists(&output) {
            return Err(format!("register_corridor failed: {output}"));
        }
        let mut update_corridor_args = Vec::new();
        push_invoke_prefix(&mut update_corridor_args, cfg, compliance, &source);
        update_corridor_args.extend([
            "--".into(),
            "update_corridor".into(),
            "--issuer".into(),
            issuer.clone(),
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
        let update = invoke_with_sequence_retry(cfg, &update_corridor_args)?;
        if !update.status.success() {
            return Err(format!(
                "update_corridor failed: {}",
                invoke_output(&update)
            ));
        }
        tracing::info!(corridor_id, "on-chain publish: update_corridor ok");
    } else {
        tracing::info!(corridor_id, "on-chain publish: register_corridor ok");
    }

    Ok(format!(
        "published roots for issuer {issuer} corridor {corridor_id} (merkle={})",
        fr_to_canonical_decimal(fr_from_decimal(&roots.merkle_root))
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_already_registered_from_cli_code() {
        let output = "HostError: Error(Contract, #20)";
        assert!(is_already_registered(output));
    }

    #[test]
    fn detects_corridor_exists_from_cli_code() {
        let output = "transaction simulation failed: Error(Contract, #21)";
        assert!(is_corridor_already_exists(output));
    }

    #[test]
    fn detects_stellar_sequence_races() {
        assert!(is_bad_sequence("transaction submission failed: TxBadSeq"));
        assert!(is_bad_sequence("result code tx_bad_seq"));
        assert!(!is_bad_sequence("HostError: Error(Contract, #21)"));
    }
}

#[allow(dead_code)]
pub fn stellar_available() -> bool {
    Command::new(
        std::env::var("STELLAR_BIN")
            .ok()
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "stellar".into()),
    )
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
