-- Phase 2: friend search (by code / QR), friend requests, block.

-- 1. friend_code: short public search handle, separate from the internal
-- uuid. Generated server-side (not user-chosen) so it can't be guessed from
-- a display name.
alter table public.profiles add column if not exists friend_code text unique;

create or replace function public.generate_friend_code()
returns text
language plpgsql
as $$
declare
  -- Excludes 0/O/1/I to avoid visual ambiguity when read off a screen.
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end;
$$;

update public.profiles set friend_code = public.generate_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (select count(*) from public.profiles) >= 110 then
    raise exception 'registration limit reached (110 accounts)';
  end if;
  insert into public.profiles (id, display_name, avatar_emoji, friend_code)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    '🙂',
    public.generate_friend_code()
  );
  return new;
end;
$$;

-- 2. blocks: one-directional. Checked by both the friend_requests insert
-- check and the messages insert check below, so blocking is enforced at the
-- RLS layer, not just hidden in the UI.
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

create policy "select own blocks" on public.blocks
  for select using (auth.uid() = blocker_id);
create policy "insert own blocks" on public.blocks
  for insert with check (auth.uid() = blocker_id);
create policy "delete own blocks" on public.blocks
  for delete using (auth.uid() = blocker_id);

-- 3. friend_requests
create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_no_self check (from_user <> to_user)
);

-- Only one pending request per unordered pair at a time (either direction).
create unique index friend_requests_unique_pending
  on public.friend_requests (least(from_user, to_user), greatest(from_user, to_user))
  where status = 'pending';

alter table public.friend_requests enable row level security;

create policy "select own requests" on public.friend_requests
  for select using (auth.uid() = from_user or auth.uid() = to_user);

create policy "insert own requests" on public.friend_requests
  for insert with check (
    auth.uid() = from_user
    and not exists (
      select 1 from public.blocks
      where (blocker_id = from_user and blocked_id = to_user)
         or (blocker_id = to_user and blocked_id = from_user)
    )
    and not exists (
      select 1 from public.friend_requests fr2
      where fr2.status = 'accepted'
        and ((fr2.from_user = friend_requests.from_user and fr2.to_user = friend_requests.to_user)
          or (fr2.from_user = friend_requests.to_user and fr2.to_user = friend_requests.from_user))
    )
  );

-- Recipient can accept/reject; sender can cancel a still-pending request.
create policy "update received requests" on public.friend_requests
  for update using (auth.uid() = to_user) with check (auth.uid() = to_user);
create policy "delete own sent requests" on public.friend_requests
  for delete using (auth.uid() = from_user and status = 'pending');

-- 4. room_members: per-viewer "removed from my friend list" flag, separate
-- from talk_hidden (トーク tab) — 友達一覧 intentionally ignores talk_hidden,
-- so removing a friend needs its own flag rather than reusing that one.
alter table public.room_members add column if not exists friend_removed boolean not null default false;

-- 5. messages: block also stops new messages between the two parties, not
-- just future friend requests.
drop policy "members can insert their own messages" on public.messages;
create policy "members can insert their own messages" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from public.room_members rm where rm.room_id = messages.room_id and rm.user_id = auth.uid())
    and not exists (
      select 1 from public.room_members other_member
      join public.blocks b
        on (b.blocker_id = other_member.user_id and b.blocked_id = auth.uid())
        or (b.blocker_id = auth.uid() and b.blocked_id = other_member.user_id)
      where other_member.room_id = messages.room_id and other_member.user_id <> auth.uid()
    )
  );

-- 6. Lookups that need to see a stranger's profile (not yet a room member,
-- so the existing "profiles readable by room members" SELECT policy
-- wouldn't allow a plain client-side query). Exact-match / own-requests-only
-- by design — no pattern search, so codes can't be enumerated by browsing.
create or replace function public.find_profile_by_code(code text)
returns table (id uuid, display_name text, avatar_emoji text, avatar_url text)
language sql security definer set search_path = public as $$
  select id, display_name, avatar_emoji, avatar_url
  from public.profiles
  where friend_code = upper(code) and id <> auth.uid();
$$;
grant execute on function public.find_profile_by_code(text) to authenticated;

create or replace function public.list_incoming_friend_requests()
returns table (id uuid, from_user uuid, display_name text, avatar_emoji text, avatar_url text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select fr.id, fr.from_user, p.display_name, p.avatar_emoji, p.avatar_url, fr.created_at
  from public.friend_requests fr
  join public.profiles p on p.id = fr.from_user
  where fr.to_user = auth.uid() and fr.status = 'pending'
  order by fr.created_at desc;
$$;
grant execute on function public.list_incoming_friend_requests() to authenticated;

create or replace function public.list_outgoing_friend_requests()
returns table (id uuid, to_user uuid, display_name text, avatar_emoji text, avatar_url text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select fr.id, fr.to_user, p.display_name, p.avatar_emoji, p.avatar_url, fr.created_at
  from public.friend_requests fr
  join public.profiles p on p.id = fr.to_user
  where fr.from_user = auth.uid() and fr.status = 'pending'
  order by fr.created_at desc;
$$;
grant execute on function public.list_outgoing_friend_requests() to authenticated;

-- 7. Accepting requires creating a room + two room_members rows atomically,
-- which the caller's own RLS grants don't otherwise allow (no INSERT policy
-- exists on rooms/room_members for regular users) — intentionally, so this
-- is the only path a room can be created through.
create or replace function public.accept_friend_request(request_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  req record;
  result_room_id uuid;
begin
  select * into req from public.friend_requests where id = request_id;
  if req is null then
    raise exception 'friend request not found';
  end if;
  if req.to_user <> auth.uid() then
    raise exception 'not authorized';
  end if;
  if req.status <> 'pending' then
    raise exception 'request already responded';
  end if;

  update public.friend_requests set status = 'accepted', responded_at = now() where id = request_id;

  select rm1.room_id into result_room_id
  from public.room_members rm1
  join public.room_members rm2 on rm1.room_id = rm2.room_id
  where rm1.user_id = req.from_user and rm2.user_id = req.to_user
  limit 1;

  if result_room_id is null then
    insert into public.rooms (name) values ('') returning id into result_room_id;
    insert into public.room_members (room_id, user_id) values
      (result_room_id, req.from_user), (result_room_id, req.to_user);
  else
    update public.room_members set talk_hidden = false, friend_removed = false
      where room_id = result_room_id and user_id in (req.from_user, req.to_user);
  end if;

  return result_room_id;
end;
$$;
grant execute on function public.accept_friend_request(uuid) to authenticated;
