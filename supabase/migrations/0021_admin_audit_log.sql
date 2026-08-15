-- Audit trail for admin-panel actions (rename, restrict, delete, individual
-- message). Written only by the admin app's service_role client, which
-- bypasses RLS entirely — RLS is enabled with no policies purely so the
-- table stays unreachable to anon/authenticated roles too, consistent with
-- how every other table in this project is locked down by default.
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  target_user_id uuid,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
