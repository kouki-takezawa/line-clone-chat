-- Storage bucket + policies for chat images.
-- The bucket itself must be created once via the Dashboard or CLI as private
-- (name: chat-images). This migration only sets up its RLS policies.

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

create policy "room members can upload chat images" on storage.objects
  for insert with check (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.room_members rm
      where rm.user_id = auth.uid()
        and (storage.foldername(name))[1] = rm.room_id::text
    )
  );

create policy "room members can read chat images" on storage.objects
  for select using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.room_members rm
      where rm.user_id = auth.uid()
        and (storage.foldername(name))[1] = rm.room_id::text
    )
  );

-- No update/delete policy for regular users: only the service-role TTL job
-- deletes expired images.
