-- Per-viewer talk-list preferences: pinning a talk to the top, and hiding
-- (removing) it from your own talk list without touching the friendship,
-- the room, or the other person's view — same room_members row a user
-- already has for that room is the natural place for these.

alter table public.room_members
  add column pinned boolean not null default false,
  add column talk_hidden boolean not null default false;

-- Lets a member toggle their own pin/hide flags. Not column-restricted
-- (a client could technically also rewrite room_id/user_id on their own
-- row), which is an acceptable tradeoff for a small trusted-client app;
-- only this project's own frontend ever calls update() on this table.
create policy "members can update their own membership prefs" on public.room_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
