-- Named admin-panel logins, replacing the single shared password. Fully
-- separate from public.profiles/auth.users — admin identities have nothing
-- to do with chat-app end users, so they don't touch the registration cap,
-- the bot-room trigger, or any end-user-facing table.
create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.admin_users enable row level security;

alter table public.admin_audit_log add column if not exists admin_username text;
