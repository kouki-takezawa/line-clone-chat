-- Phase 3: unsend (delete own message), emoji reactions.

-- 1. Unsend: sender can delete their own message before the 24h TTL would
-- have anyway. Realtime's existing DELETE subscription (ChatRoom.tsx)
-- already removes it live for both participants — no new client wiring.
create policy "sender can delete own message" on public.messages
  for delete using (sender_id = auth.uid());

-- 2. Image cleanup on delete, generalized: previously only
-- purge_expired_messages() cleaned up Storage images (via an inline loop),
-- which covered TTL expiry but not a message deleted any other way (like
-- the unsend policy just above). Moving that cleanup into a trigger makes
-- it fire for every deletion path uniformly, so unsent images don't leak
-- in Storage forever. purge_expired_messages() below drops its old inline
-- loop now that this trigger covers it.
create or replace function public.cleanup_deleted_message_image()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_service_key text;
  v_project_url text := 'https://ghezgxzljdfdowknonlg.supabase.co';
begin
  if old.image_path is null then
    return old;
  end if;

  select decrypted_secret into v_service_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_service_key is not null then
    perform net.http_delete(
      url := v_project_url || '/storage/v1/object/chat-images/' || old.image_path,
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'apikey', v_service_key)
    );
  end if;
  return old;
end;
$$;

create trigger on_message_delete_cleanup_image
  after delete on public.messages
  for each row execute procedure public.cleanup_deleted_message_image();

create or replace function public.purge_expired_messages()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ttl_hours int;
  v_cutoff timestamptz;
begin
  select ttl_hours into v_ttl_hours from public.settings where id = true;
  v_cutoff := now() - (coalesce(v_ttl_hours, 24) || ' hours')::interval;
  -- Per-row image cleanup now happens via on_message_delete_cleanup_image.
  delete from public.messages where created_at < v_cutoff;
end;
$$;

-- 3. Emoji reactions: one reaction per user per message (reacting again
-- with a different emoji replaces it, via upsert on this primary key).
create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_reactions enable row level security;

create policy "room members can read reactions" on public.message_reactions
  for select using (
    exists (
      select 1 from public.messages m
      join public.room_members rm on rm.room_id = m.room_id
      where m.id = message_reactions.message_id and rm.user_id = auth.uid()
    )
  );

create policy "room members can react" on public.message_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      join public.room_members rm on rm.room_id = m.room_id
      where m.id = message_reactions.message_id and rm.user_id = auth.uid()
    )
  );

create policy "users can update own reaction" on public.message_reactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users can remove own reaction" on public.message_reactions
  for delete using (user_id = auth.uid());

alter publication supabase_realtime add table public.message_reactions;
alter table public.message_reactions replica identity full;
