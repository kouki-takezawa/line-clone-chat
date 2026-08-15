-- The announcements bot (profiles.is_system_bot) must always stay reachable
-- and pinned in every user's トーク一覧: it can't be blocked, and its 1:1
-- room can't be hidden/removed from a user's own view. Enforced here (not
-- just in the UI) because RLS/triggers, not client checks, are this
-- project's real authorization boundary — see 0012_open_registration.sql's
-- rate-limit trigger for the same pattern.

create or replace function public.prevent_bot_block()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = new.blocked_id and is_system_bot) then
    raise exception 'cannot block the announcements bot';
  end if;
  return new;
end;
$$;

create trigger prevent_bot_block_trigger
before insert on public.blocks
for each row execute function public.prevent_bot_block();

create or replace function public.prevent_bot_room_removal()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.talk_hidden and not old.talk_hidden) or (new.friend_removed and not old.friend_removed) then
    if exists (
      select 1 from public.room_members rm
      join public.profiles p on p.id = rm.user_id
      where rm.room_id = new.room_id and p.is_system_bot
    ) then
      raise exception 'cannot remove or hide the announcements bot talk';
    end if;
  end if;
  return new;
end;
$$;

create trigger prevent_bot_room_removal_trigger
before update on public.room_members
for each row execute function public.prevent_bot_room_removal();
