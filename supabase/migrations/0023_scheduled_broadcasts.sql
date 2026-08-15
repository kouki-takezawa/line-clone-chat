-- Reserved (send-later) broadcasts for the admin panel. A pg_cron job
-- (mirroring the pattern already used for TTL purge in migration 0009)
-- checks every minute for due, unsent rows and delivers them through the
-- same announcements-bot rooms the immediate broadcast feature uses.
create table public.scheduled_broadcasts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.scheduled_broadcasts enable row level security;

create index scheduled_broadcasts_due_idx on public.scheduled_broadcasts (scheduled_at) where sent_at is null;

create or replace function public.send_due_scheduled_broadcasts()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_bot_id uuid;
  v_row record;
  v_count integer := 0;
begin
  select id into v_bot_id from public.profiles where is_system_bot limit 1;
  if v_bot_id is null then
    return 0;
  end if;

  for v_row in
    select * from public.scheduled_broadcasts
    where sent_at is null and scheduled_at <= now()
    order by scheduled_at
  loop
    insert into public.messages (room_id, sender_id, body)
    select rm.room_id, v_bot_id, v_row.message
    from public.room_members rm
    where rm.user_id = v_bot_id;

    update public.scheduled_broadcasts set sent_at = now() where id = v_row.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

select cron.schedule(
  'send-due-scheduled-broadcasts',
  '* * * * *',
  $$select public.send_due_scheduled_broadcasts();$$
);
