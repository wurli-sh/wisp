pub fn short_key(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    if chars.len() > 11 {
        let head: String = chars[..4].iter().collect();
        let tail: String = chars[chars.len().saturating_sub(4)..].iter().collect();
        format!("{head}\u{2026}{tail}")
    } else {
        value.to_string()
    }
}

pub fn short_root(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    if chars.len() > 16 {
        let head: String = chars[..16].iter().collect();
        format!("{head}\u{2026}")
    } else {
        value.to_string()
    }
}
