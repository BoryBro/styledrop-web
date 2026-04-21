create table if not exists gift_codes (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  credits integer not null,
  amount integer not null,
  status text not null default 'unused',  -- 'unused' | 'used'
  created_by text not null,
  used_by text,
  created_at timestamptz default now(),
  used_at timestamptz,
  expires_at timestamptz not null
);

create index if not exists gift_codes_code_idx on gift_codes (code);
create index if not exists gift_codes_created_by_idx on gift_codes (created_by);
