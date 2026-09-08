-- The "un-hide talk on new message" rule (0026) has moved to application
-- code: POST /api/messages now inserts the message through the request's
-- own RLS-scoped client (so membership/block checks still apply exactly as
-- before) and then clears room_members.talk_hidden for the room using the
-- service-role client, instead of a database trigger doing it. Drop the
-- trigger and its function as a fresh migration, per this project's
-- convention of not editing already-applied migrations.

drop trigger if exists on_message_insert_unhide_talk on public.messages;
drop function if exists public.unhide_talk_on_new_message();
