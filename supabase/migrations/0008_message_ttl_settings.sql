-- Admin-configurable message retention (replaces the hardcoded 24h TTL).

create table public.settings (
  id boolean primary key default true,
  ttl_hours int not null default 24 check (ttl_hours between 1 and 24),
  constraint settings_singleton check (id)
);

insert into public.settings (id, ttl_hours) values (true, 24);

alter table public.settings enable row level security;

create policy "any authenticated user can read settings" on public.settings
  for select using (auth.role() = 'authenticated');

create policy "admin can update settings" on public.settings
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
