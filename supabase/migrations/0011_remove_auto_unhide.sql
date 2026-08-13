-- Reverses 0010: swipe-delete (トーク一覧 -> 削除) hides a talk from only
-- the caller's own トーク一覧 — it never touches the other participant's
-- view or the message rows themselves. That hide must never be undone
-- automatically, so the "unhide on new message" trigger is removed;
-- once hidden, a talk stays hidden until the user's device deletes it via
-- the 24h TTL purge (which removes it from both sides for real) or some
-- future explicit "undo" action.

drop trigger if exists on_message_insert_unhide_talk on public.messages;
drop function if exists public.unhide_talk_on_new_message();
