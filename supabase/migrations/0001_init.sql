-- Core schema: profiles, rooms, room_members, messages + RLS

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_emoji text not null default '🙂',
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Family Chat',
  created_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  image_path text,
  image_width int,
  image_height int,
  created_at timestamptz not null default now(),
  constraint body_or_image check (body is not null or image_path is not null)
);

create index messages_room_created_idx on public.messages (room_id, created_at desc);
create index messages_created_idx on public.messages (created_at);

-- auto-create a blank profile row whenever a new auth user is created
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;

create policy "profiles readable by room members" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.room_members rm1
      join public.room_members rm2 on rm1.room_id = rm2.room_id
      where rm1.user_id = auth.uid() and rm2.user_id = profiles.id
    )
  );

create policy "user can update own profile" on public.profiles
  for update using (id = auth.uid());

create policy "members can read their rooms" on public.rooms
  for select using (
    exists (select 1 from public.room_members rm where rm.room_id = rooms.id and rm.user_id = auth.uid())
  );

create policy "members can read membership" on public.room_members
  for select using (
    exists (select 1 from public.room_members rm where rm.room_id = room_members.room_id and rm.user_id = auth.uid())
  );

create policy "members can read messages" on public.messages
  for select using (
    exists (select 1 from public.room_members rm where rm.room_id = messages.room_id and rm.user_id = auth.uid())
  );

create policy "members can insert their own messages" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from public.room_members rm where rm.room_id = messages.room_id and rm.user_id = auth.uid())
  );

-- No update/delete policy for regular users: messages are immutable from the
-- client, and only the service-role TTL job (which bypasses RLS) may delete.
