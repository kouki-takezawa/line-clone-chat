-- Two narrower restriction types, set from the admin panel, distinct from
-- a full account ban (Supabase Auth ban_duration): one blocks gaining new
-- friends, the other blocks sending messages in talks the user already has
-- (the talk screen itself stays open/readable — only sending is blocked).

alter table public.profiles add column if not exists friend_requests_restricted boolean not null default false;
alter table public.profiles add column if not exists messaging_restricted boolean not null default false;

-- 1. Friend-request restriction: blocks both sending a new request and
-- accepting an incoming one, so a restricted user can't route around it by
-- having someone else send the request instead.

drop policy "insert own requests" on public.friend_requests;
create policy "insert own requests" on public.friend_requests
  for insert with check (
    auth.uid() = from_user
    and not public.is_blocked_pair(from_user, to_user)
    and not (select p.friend_requests_restricted from public.profiles p where p.id = from_user)
    and not exists (
      select 1 from public.friend_requests fr2
      where fr2.status = 'accepted'
        and ((fr2.from_user = friend_requests.from_user and fr2.to_user = friend_requests.to_user)
          or (fr2.from_user = friend_requests.to_user and fr2.to_user = friend_requests.from_user))
    )
  );

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
  if (select friend_requests_restricted from public.profiles where id = auth.uid()) then
    raise exception 'friend requests are restricted for this account';
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

-- 2. Messaging restriction: the talk screen stays fully readable (no RLS
-- change to messages SELECT / room_members), only sending is blocked.
drop policy "members can insert their own messages" on public.messages;
create policy "members can insert their own messages" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and not (select p.messaging_restricted from public.profiles p where p.id = auth.uid())
    and exists (select 1 from public.room_members rm where rm.room_id = messages.room_id and rm.user_id = auth.uid())
    and not exists (
      select 1 from public.room_members other_member
      where other_member.room_id = messages.room_id
        and other_member.user_id <> auth.uid()
        and public.is_blocked_pair(auth.uid(), other_member.user_id)
    )
  );
