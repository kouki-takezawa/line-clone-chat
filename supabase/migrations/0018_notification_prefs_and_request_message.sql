-- Notification body preview opt-out (recipient's own preference — whether
-- their own push notifications show message content or just "新着メッセージ").
alter table public.profiles add column if not exists show_notification_preview boolean not null default true;

-- Optional note attached to a friend request.
alter table public.friend_requests add column if not exists message text;

drop function if exists public.list_incoming_friend_requests();
drop function if exists public.list_outgoing_friend_requests();

create or replace function public.list_incoming_friend_requests()
returns table (id uuid, from_user uuid, display_name text, avatar_emoji text, avatar_url text, message text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select fr.id, fr.from_user, p.display_name, p.avatar_emoji, p.avatar_url, fr.message, fr.created_at
  from public.friend_requests fr
  join public.profiles p on p.id = fr.from_user
  where fr.to_user = auth.uid() and fr.status = 'pending'
  order by fr.created_at desc;
$$;

create or replace function public.list_outgoing_friend_requests()
returns table (id uuid, to_user uuid, display_name text, avatar_emoji text, avatar_url text, message text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select fr.id, fr.to_user, p.display_name, p.avatar_emoji, p.avatar_url, fr.message, fr.created_at
  from public.friend_requests fr
  join public.profiles p on p.id = fr.to_user
  where fr.from_user = auth.uid() and fr.status = 'pending'
  order by fr.created_at desc;
$$;
