-- Enforces the ttl_hours from public.settings, deleting expired messages
-- (and best-effort their Storage images) on a schedule. Implemented as a
-- plain Postgres function + pg_cron rather than a Supabase Edge Function,
-- since this can be deployed with a plain SQL migration — no CLI/access
-- token required.
--
-- The service role key this function needs to call the Storage API is
-- intentionally NOT stored here — it's inserted separately via
-- `vault.create_secret(...)` (see SETUP.md) so it never enters git history.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.purge_expired_messages()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ttl_hours int;
  v_cutoff timestamptz;
  v_service_key text;
  v_project_url text := 'https://ghezgxzljdfdowknonlg.supabase.co';
  v_msg record;
begin
  select ttl_hours into v_ttl_hours from public.settings where id = true;
  v_cutoff := now() - (coalesce(v_ttl_hours, 24) || ' hours')::interval;

  select decrypted_secret into v_service_key
  from vault.decrypted_secrets where name = 'service_role_key';

  -- Best-effort image cleanup: if the secret isn't configured yet, skip
  -- straight to deleting the rows rather than blocking the whole purge.
  if v_service_key is not null then
    for v_msg in
      select image_path from public.messages
      where created_at < v_cutoff and image_path is not null
    loop
      perform net.http_delete(
        url := v_project_url || '/storage/v1/object/chat-images/' || v_msg.image_path,
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'apikey', v_service_key)
      );
    end loop;
  end if;

  delete from public.messages where created_at < v_cutoff;
end;
$$;

select cron.schedule(
  'purge-expired-messages',
  '*/15 * * * *',
  $$select public.purge_expired_messages();$$
);
