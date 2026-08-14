-- Phase 4: read receipts, per-conversation mute, unread badge support.

alter table public.room_members add column if not exists last_read_at timestamptz not null default now();
alter table public.room_members add column if not exists muted boolean not null default false;

-- Needed so a viewer's browser gets the *other* member's last_read_at
-- update live (to flip a sent message to "既読"). The existing "members
-- can read membership" SELECT policy already allows seeing both rows in a
-- shared room (only UPDATE is restricted to one's own row), so this is
-- just turning on delivery for what RLS already permits reading.
alter publication supabase_realtime add table public.room_members;
alter table public.room_members replica identity full;
