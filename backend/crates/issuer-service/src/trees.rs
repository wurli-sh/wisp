use serde_json::Value;
use wisp_types::{CorridorOption, DemoUsersFixture};

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
