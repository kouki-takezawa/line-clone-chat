-- Enable Realtime change events for messages (INSERT for new messages,
-- DELETE for TTL purges so clients can remove expired messages live).

alter publication supabase_realtime add table public.messages;
alter table public.messages replica identity full;
