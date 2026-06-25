use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;
use wisp_types::{
    CorridorOption, DemoTransferFixture, DemoTransferRequest, DemoUsersFixture, EPOCH_LEN_SECS,
};

#[derive(Debug)]
pub struct NormalizedProviderEvent {
    pub provider: String,
    pub provider_ref: String,
    pub wallet: String,
    pub jurisdiction: String,
    pub jurisdiction_code: u32,
    pub credential_expiry: u64,
    pub sanctions_clear: bool,
    pub enabled: bool,
    pub credential_secret: String,
    pub metadata: Value,
}

pub fn strkey_to_payload(strkey: &str) -> Result<[u8; 32], String> {
    const ALPHABET: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    let mut bits = 0u32;
    let mut value = 0u32;
    let mut bytes = Vec::new();

    for ch in strkey.chars().filter(|c| !c.is_ascii_whitespace()) {
        let upper = ch.to_ascii_uppercase();
        let Some(idx) = ALPHABET.find(upper) else {
            return Err(format!("invalid strkey character: {ch}"));
        };
        value = (value << 5) | idx as u32;
        bits += 5;
        while bits >= 8 {
            bits -= 8;
            bytes.push(((value >> bits) & 0xff) as u8);
        }
    }

    if bytes.len() < 35 {
        return Err("strkey payload too short".into());
    }

    let payload = &bytes[1..33];
    payload
        .try_into()
        .map_err(|_| "invalid strkey payload width".to_string())
}

pub fn payload_to_hex(payload: &[u8; 32]) -> String {
    payload.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn current_epoch() -> u64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before unix epoch")
        .as_secs();
    now / EPOCH_LEN_SECS
}

fn country_code(users: &DemoUsersFixture, country: &str) -> Result<u32, String> {
    users
        .users
        .iter()
        .find(|u| u.jurisdiction.eq_ignore_ascii_case(country))
        .map(|u| u.jurisdiction_code)
        .ok_or_else(|| format!("unsupported source country: {country}"))
}

pub fn corridor_options(users: &DemoUsersFixture) -> Vec<CorridorOption> {
    users
        .corridors
        .iter()
        .filter_map(|c| {
            let normalized = c.name.replace('→', "-");
            let mut parts = normalized.split('-').map(str::trim);
            let source_country = parts.next()?.to_string();
            let dest_country = parts.next()?.to_string();
            Some(CorridorOption {
                id: c.id,
                name: c.name.clone(),
                source_country,
                dest_country,
                enabled: c.enabled,
            })
        })
        .collect()
}

pub fn build_dynamic_demo_fixture(
    req: &DemoTransferRequest,
    users: &DemoUsersFixture,
    template: &DemoTransferFixture,
) -> Result<DemoTransferFixture, String> {
    let sender = strkey_to_payload(&req.sender_strkey)?;
    let recipient = strkey_to_payload(&req.recipient_strkey)?;

    let corridor = corridor_options(users)
        .into_iter()
        .find(|c| c.id == req.corridor_id && c.enabled)
        .ok_or_else(|| format!("unknown enabled corridor id: {}", req.corridor_id))?;

    if !corridor
        .source_country
        .eq_ignore_ascii_case(&req.source_country)
    {
        return Err(format!(
            "source country {} does not match corridor {}",
            req.source_country, corridor.name
        ));
    }
    if !corridor
        .dest_country
        .eq_ignore_ascii_case(&req.dest_country)
    {
        return Err(format!(
            "destination country {} does not match corridor {}",
            req.dest_country, corridor.name
        ));
    }

    let amount = req.amount.trim();
    let parsed_amount: i128 = amount
        .parse()
        .map_err(|_| format!("invalid amount: {}", req.amount))?;
    if parsed_amount <= 0 {
        return Err("amount must be greater than zero".into());
    }

    let epoch = current_epoch();
    let jurisdiction_code = country_code(users, &req.source_country)?;

    Ok(DemoTransferFixture {
        demo_only: true,
        credential_secret: template.credential_secret.clone(),
        transfer_nonce: template.transfer_nonce.clone(),
        corridor_id: req.corridor_id,
        sender_hex: payload_to_hex(&sender),
        recipient_hex: payload_to_hex(&recipient),
        asset_hex: template.asset_hex.clone(),
        amount: parsed_amount.to_string(),
        epoch: epoch.to_string(),
        jurisdiction: jurisdiction_code.to_string(),
        credential_expiry: template.credential_expiry.clone(),
        sender_strkey: Some(req.sender_strkey.clone()),
        recipient_strkey: Some(req.recipient_strkey.clone()),
        asset_strkey: template.asset_strkey.clone(),
        issuer_strkey: template.issuer_strkey.clone(),
        source_country: Some(corridor.source_country),
        dest_country: Some(corridor.dest_country),
    })
}
