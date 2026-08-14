-- The client-side app badge count was being inferred from
-- ServiceWorkerRegistration.getNotifications() (how many notification
-- objects the browser still thinks are showing). That's fragile — iOS
-- Safari's Web Push implementation doesn't always keep that in sync with
-- what's actually in the OS notification center, so a stale badge number
-- persisted even after the notifications were read/replied to. This RPC
-- gives the client a single source of truth (actual unread rows) to set
-- the badge from instead, independent of notification-tracking quirks.
create or replace function public.count_unread_messages()
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(count(*), 0)::integer
  from public.messages m
  join public.room_members rm on rm.room_id = m.room_id and rm.user_id = auth.uid()
  where m.sender_id <> auth.uid() and m.created_at > rm.last_read_at;
$$;
grant execute on function public.count_unread_messages() to authenticated;
