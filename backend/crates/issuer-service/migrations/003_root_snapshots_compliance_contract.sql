alter table if exists root_snapshots
  add column if not exists compliance_contract_id text;
