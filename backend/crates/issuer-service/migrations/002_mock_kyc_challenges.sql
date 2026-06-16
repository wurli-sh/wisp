create table if not exists mock_kyc_challenges (
  id uuid primary key default gen_random_uuid(),
  wallet_hex text not null,
  challenge_xdr text not null,
  nonce text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mock_kyc_challenges_wallet_hex_idx on mock_kyc_challenges (wallet_hex);
