-- Phase 1 of the move to an open, email-registered community app (up to
-- ~100 users): drop the closed admin-invite/login-ID model, add real
-- profile photos, and bake in the capacity/security safeguards from
-- SECURITY_AND_CAPACITY.md (registration cap, message rate limit, message
-- length cap).

-- The open-community spec fixes retention at 24h with no admin role to
-- adjust it, so the admin-gated settings.ttl_hours UPDATE policy (which
-- depends on profiles.is_admin) is retired along with is_admin itself.
-- ttl_hours stays at its current value (24) and is no longer editable via
-- RLS by any client — only a direct DB migration could change it now.
drop policy if exists "admin can update settings" on public.settings;

alter table public.profiles
  drop column if exists login_id,
  drop column if exists is_admin,
  add column if not exists avatar_url text;

-- Registration is now open (Supabase Auth "Allow sign ups" must be turned
-- back on in the Dashboard), so the new-user trigger no longer takes
-- login_id/is_admin metadata, and now enforces the 110-account cap at the
-- DB level so it can't be bypassed by calling signUp directly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (select count(*) from public.profiles) >= 110 then
    raise exception 'registration limit reached (110 accounts)';
  end if;

  insert into public.profiles (id, display_name, avatar_emoji)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    '🙂'
  );
  return new;
end;
$$;

-- Message length cap: defense in depth alongside the client's maxLength.
alter table public.messages
  add constraint messages_body_length check (body is null or char_length(body) <= 1000);

-- Rate limiting, enforced at the DB level so it can't be bypassed by a
-- script calling the API directly (client-side throttling alone can't
-- stop that): max 3 messages/second and 5 images/minute per sender, plus
-- the 20-images/24h cap from the capacity design.
create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.messages
  where sender_id = new.sender_id and created_at > now() - interval '1 second';
  if v_count >= 3 then
    raise exception 'rate limit: too many messages per second';
  end if;

  if new.image_path is not null then
    select count(*) into v_count
    from public.messages
    where sender_id = new.sender_id
      and image_path is not null
      and created_at > now() - interval '1 minute';
    if v_count >= 5 then
      raise exception 'rate limit: too many images per minute';
    end if;

    select count(*) into v_count
    from public.messages
    where sender_id = new.sender_id
      and image_path is not null
      and created_at > now() - interval '24 hours';
    if v_count >= 20 then
      raise exception 'rate limit: daily image limit reached (20/24h)';
    end if;
  end if;

  return new;
end;
$$;

create trigger on_message_insert_rate_limit
  before insert on public.messages
  for each row execute procedure public.enforce_message_rate_limit();

-- Profile photos. Public (unlike the private chat-images bucket): a
-- profile photo is closer to public identity info in a friend network
-- than ephemeral chat content, and keeping it public avoids needing
-- signed-URL regeneration in every place an avatar is shown.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

create policy "users can upload their own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can replace their own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
