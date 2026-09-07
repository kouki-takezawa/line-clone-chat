-- Bug fix: after 0011 removed the "unhide talk on new message" trigger, a
-- talk hidden via トーク削除 (room_members.talk_hidden = true) stayed hidden
-- forever, even once the other participant sent a genuinely new message.
-- Deleting a talk should only clear the *existing* history from view — once
-- new activity happens, it must reappear in トーク一覧, matching real LINE.
-- Re-adding the 0010 trigger as a fresh migration (rather than reverting
-- 0011) so the intent stays visible in history.
--
-- Runs as SECURITY DEFINER because it needs to clear talk_hidden on BOTH
-- participants' room_members rows (the sender can only update their own row
-- under RLS; the recipient's row also needs clearing so a message you
-- receive un-hides the talk for you too).
--
-- Blocked pairs are unaffected: "members can insert their own messages"
-- (0014) already rejects message inserts between blocked users, so this
-- trigger never fires for a room hidden via block-and-remove.

create or replace function public.unhide_talk_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.room_members
  set talk_hidden = false
  where room_id = new.room_id and talk_hidden = true;
  return new;
end;
$$;

create trigger on_message_insert_unhide_talk
  after insert on public.messages
  for each row execute procedure public.unhide_talk_on_new_message();
