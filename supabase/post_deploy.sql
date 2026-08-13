-- Run this manually in the Supabase SQL Editor AFTER deploying both Edge
-- Functions (purge-expired, send-push) and setting their secrets.
-- Not part of the versioned migrations because it embeds your function
-- secret / project ref — fill in the placeholders below first.
--
-- Replace:
--   <PROJECT_REF>      e.g. abcdefghijklmnop
--   <FUNCTION_SECRET>  the same value you set with `supabase secrets set FUNCTION_SECRET=...`

-- 1) Purge expired messages/images every 15 minutes.
select cron.schedule(
  'purge-expired-messages',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/purge-expired',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-function-secret', '<FUNCTION_SECRET>'
    )
  );
  $$
);

-- 2) Send a push notification whenever a new message is inserted.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-function-secret', '<FUNCTION_SECRET>'
    ),
    body := jsonb_build_object('type', 'INSERT', 'table', 'messages', 'record', to_jsonb(new))
  );
  return new;
end;
$$;

create trigger on_message_insert_notify
  after insert on public.messages
  for each row execute procedure public.notify_new_message();
