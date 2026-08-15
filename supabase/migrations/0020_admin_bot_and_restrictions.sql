-- Admin panel support: a system "announcements" bot that every user is
-- auto-connected to (so a broadcast reaches them without a friend
-- request), and rate-limit/registration-cap exemptions for it. Account
-- "restriction" itself needs no schema change — it uses Supabase Auth's
-- built-in ban_duration via the Admin API, set from the separate admin app.

alter table public.profiles add column if not exists is_system_bot boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_bot boolean := coalesce((new.raw_user_meta_data->>'is_system_bot')::boolean, false);
  v_bot_id uuid;
  v_room_id uuid;
begin
  if not v_is_bot and (select count(*) from public.profiles where not is_system_bot) >= 110 then
    raise exception 'registration limit reached (110 accounts)';
  end if;

  insert into public.profiles (id, display_name, avatar_emoji, friend_code, is_system_bot)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    '🙂',
    public.generate_friend_code(),
    v_is_bot
  );

  -- Auto-connect every new (non-bot) user with the announcements bot, if
  -- one has been configured, so admin broadcasts reach them without
  -- needing a friend request first.
  if not v_is_bot then
    select id into v_bot_id from public.profiles where is_system_bot limit 1;
    if v_bot_id is not null then
      insert into public.rooms (name) values ('') returning id into v_room_id;
      insert into public.room_members (room_id, user_id) values (v_room_id, new.id), (v_room_id, v_bot_id);
    end if;
  end if;

  return new;
end;
$$;

-- One-time (re-runnable) backfill: connects every existing user who
-- doesn't already share a room with the bot. Called manually, once, after
-- the bot account is created — there's no bot yet when this migration
-- itself runs, so this can't be inline DML.
create or replace function public.ensure_bot_rooms_for_all_users()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_bot_id uuid;
  v_user record;
  v_room_id uuid;
  v_count integer := 0;
begin
  select id into v_bot_id from public.profiles where is_system_bot limit 1;
  if v_bot_id is null then
    raise exception 'no system bot configured';
  end if;

  for v_user in
    select p.id from public.profiles p
    where not p.is_system_bot
      and not exists (
        select 1 from public.room_members rm1
        join public.room_members rm2 on rm1.room_id = rm2.room_id
        where rm1.user_id = p.id and rm2.user_id = v_bot_id
      )
  loop
    insert into public.rooms (name) values ('') returning id into v_room_id;
    insert into public.room_members (room_id, user_id) values (v_room_id, v_user.id), (v_room_id, v_bot_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- The bot needs to be able to message every user in a single burst
-- (broadcast), which would otherwise trip the same anti-spam limits
-- designed for regular accounts.
create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
  v_is_bot boolean;
begin
  select is_system_bot into v_is_bot from public.profiles where id = new.sender_id;
  if coalesce(v_is_bot, false) then
    return new;
  end if;

  select count(*) into v_count
  from public.messages
  where sender_id = new.sender_id and created_at > now() - interval '1 second';
  if v_count >= 3 then
    raise exception 'rate limit: too many messages per second';
  end if;

  if new.image_path is not null then
    select count(*) into v_count
    from public.messages
    where sender_id = new.sender_id
      and image_path is not null
      and created_at > now() - interval '1 minute';
    if v_count >= 5 then
      raise exception 'rate limit: too many images per minute';
    end if;

    select count(*) into v_count
    from public.messages
    where sender_id = new.sender_id
      and image_path is not null
      and created_at > now() - interval '24 hours';
    if v_count >= 20 then
      raise exception 'rate limit: daily image limit reached (20/24h)';
    end if;
  end if;

  return new;
end;
$$;
