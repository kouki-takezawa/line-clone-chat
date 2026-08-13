-- A "deleted" talk (room_members.talk_hidden = true) should stay hidden
-- from the トーク list until there's actually new activity in it — merely
-- opening it from 友達一覧 to read old messages must NOT bring it back,
-- or "delete" would have no effect. Unhide only when a message is sent.
--
-- Runs as SECURITY DEFINER because it needs to clear talk_hidden on BOTH
-- participants' room_members rows (the sender can only update their own
-- row under RLS; the recipient's row also needs clearing so a message you
-- receive un-hides the talk for you too, matching real LINE behavior).

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
