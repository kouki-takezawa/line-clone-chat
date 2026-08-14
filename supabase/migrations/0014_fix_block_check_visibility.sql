-- Bug fix: the messages/friend_requests insert policies queried `blocks`
-- directly, but blocks' own SELECT policy ("select own blocks", blocker_id
-- = auth.uid()) only lets a user see rows where *they* are the blocker —
-- not rows where they are the blocked party. That made the block check
-- silently invisible from the blocked user's side (their own RLS-scoped
-- subquery saw zero matching rows), so the blocked user could still send
-- messages/requests even though the blocker's side was correctly stopped.
-- A SECURITY DEFINER function bypasses that table's RLS for this specific,
-- narrow existence check, without weakening blocks' own SELECT policy.
create or replace function public.is_blocked_pair(user_a uuid, user_b uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = user_a and blocked_id = user_b)
       or (blocker_id = user_b and blocked_id = user_a)
  );
$$;
grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated;

drop policy "members can insert their own messages" on public.messages;
create policy "members can insert their own messages" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from public.room_members rm where rm.room_id = messages.room_id and rm.user_id = auth.uid())
    and not exists (
      select 1 from public.room_members other_member
      where other_member.room_id = messages.room_id
        and other_member.user_id <> auth.uid()
        and public.is_blocked_pair(auth.uid(), other_member.user_id)
    )
  );

drop policy "insert own requests" on public.friend_requests;
create policy "insert own requests" on public.friend_requests
  for insert with check (
    auth.uid() = from_user
    and not public.is_blocked_pair(from_user, to_user)
    and not exists (
      select 1 from public.friend_requests fr2
      where fr2.status = 'accepted'
        and ((fr2.from_user = friend_requests.from_user and fr2.to_user = friend_requests.to_user)
          or (fr2.from_user = friend_requests.to_user and fr2.to_user = friend_requests.from_user))
    )
  );
