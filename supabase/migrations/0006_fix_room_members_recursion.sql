-- "members can read membership" on room_members queried room_members from
-- within its own USING clause, which Postgres RLS re-evaluates recursively
-- on every access to the table (error: "infinite recursion detected in
-- policy for relation room_members"). This broke every query that touches
-- room_members, including reading your own profile.
--
-- Fix: move the membership check into a SECURITY DEFINER function. Definer
-- functions run as the function owner (the migration role), which is not
-- subject to RLS on this table (only FORCE ROW LEVEL SECURITY tables are),
-- so the lookup inside no longer re-triggers the policy.

create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

drop policy if exists "members can read membership" on public.room_members;

create policy "members can read membership" on public.room_members
  for select using (
    public.is_room_member(room_members.room_id, auth.uid())
  );
