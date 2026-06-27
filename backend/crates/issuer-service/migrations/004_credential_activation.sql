create table if not exists issuer_activated_credentials (
  id bigserial primary key,
  user_id bigint not null references issuer_users(id) on delete cascade,
  wallet text not null unique,
  credential_commitment text not null,
  jurisdiction_code integer not null,
  credential_expiry bigint not null,
  enabled boolean not null default true,
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists issuer_challenges (
  id uuid primary key default gen_random_uuid(),
  wallet_hex text not null,
  wallet_strkey text not null,
  purpose text not null,
  message text not null,
  payload jsonb not null,
  nonce text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists issuer_activated_credentials_wallet_idx on issuer_activated_credentials (wallet);
create index if not exists issuer_challenges_wallet_hex_idx on issuer_challenges (wallet_hex);
