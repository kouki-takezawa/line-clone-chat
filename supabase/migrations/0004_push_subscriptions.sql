-- Per-browser Web Push subscriptions, used by the notification ON/OFF toggle.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "user can manage own push subscriptions" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The send-push Edge Function reads across all members' subscriptions using
-- the service-role key, which bypasses RLS, so no cross-user select policy
-- is needed here.
