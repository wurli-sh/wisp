create table if not exists issuer_users (
  id bigserial primary key,
  wallet text not null unique,
  jurisdiction text not null,
  jurisdiction_code integer not null,
  credential_expiry bigint not null,
  sanctions_clear boolean not null default true,
  enabled boolean not null default true,
  provider text,
  provider_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists issuer_credentials (
  id bigserial primary key,
  user_id bigint not null references issuer_users(id) on delete cascade,
  credential_secret text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists corridors (
  id integer primary key,
  name text not null,
  source_country text not null,
  dest_country text not null,
  enabled boolean not null default true,
  asset_hex text not null,
  issuer_strkey text,
  travel_rule_threshold text not null default '0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists corridor_destinations (
  id bigserial primary key,
  corridor_id integer not null references corridors(id) on delete cascade,
  address text not null,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (corridor_id, address)
);

create table if not exists root_snapshots (
  id bigserial primary key,
  corridor_id integer not null references corridors(id) on delete cascade,
  merkle_root text not null,
  sanctions_root text not null,
  jurisdiction_root text not null,
  source_jurisdiction_root text not null,
  dest_address_root text not null,
  corridor_config_hash text not null,
  publish_status text not null,
  publish_message text,
  created_at bigint not null,
  activated_at bigint
);

create table if not exists webhook_events (
  id bigserial primary key,
  provider text not null,
  event_key text not null,
  payload jsonb not null,
  processed boolean not null default false,
  created_at bigint not null,
  unique (provider, event_key)
);

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
