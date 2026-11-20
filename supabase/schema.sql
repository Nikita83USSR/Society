-- Society initial schema. Run this in Supabase SQL Editor.
-- Replace owner GitHub login in is_society_owner() if the site owner changes.
create extension if not exists pgcrypto;

create or replace function public.is_society_owner()
returns boolean language sql stable as $$
  select coalesce(
    auth.jwt() -> 'user_metadata' ->> 'user_name',
    auth.jwt() -> 'user_metadata' ->> 'preferred_username',
    ''
  ) = 'Nikita83USSR';
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  github_login text unique not null,
  display_name text not null,
  avatar_url text,
  profile_url text,
  bio text,
  updated_at timestamptz not null default now()
);

create or replace function public.sync_society_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles(id, github_login, display_name, avatar_url, profile_url, bio, updated_at)
  values (
    new.id,
    coalesce(meta->>'user_name', meta->>'preferred_username', meta->>'login', 'github-user'),
    coalesce(meta->>'full_name', meta->>'name', meta->>'user_name', 'GitHub user'),
    meta->>'avatar_url',
    meta->>'html_url',
    meta->>'bio',
    now()
  )
  on conflict (id) do update set
    github_login = excluded.github_login,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    profile_url = excluded.profile_url,
    bio = excluded.bio,
    updated_at = now();
  return new;
end; $$;

drop trigger if exists society_profile_sync on auth.users;
create trigger society_profile_sync after insert or update of raw_user_meta_data on auth.users
for each row execute procedure public.sync_society_profile();

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  wall_owner_id uuid references public.profiles(id) on delete cascade,
  body text not null default '',
  link_url text,
  image_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint post_has_content check (length(trim(body)) > 0 or link_url is not null or cardinality(image_urls) > 0)
);
create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_wall_idx on public.posts(wall_owner_id, created_at desc);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments(post_id, created_at);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 3000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_pair_idx on public.messages(sender_id, recipient_id, created_at);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public" on public.profiles for select using (true);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Posts are public" on public.posts;
create policy "Posts are public" on public.posts for select using (true);
drop policy if exists "Signed-in users publish" on public.posts;
create policy "Signed-in users publish" on public.posts for insert to authenticated with check (
  author_id = auth.uid() and (wall_owner_id is null or is_society_owner() or wall_owner_id = auth.uid())
);
drop policy if exists "Authors or wall owner delete posts" on public.posts;
create policy "Authors or wall owner delete posts" on public.posts for delete to authenticated using (
  author_id = auth.uid() or (wall_owner_id is not null and exists (
    select 1 from public.profiles p where p.id = wall_owner_id and p.github_login = 'Nikita83USSR' and is_society_owner()
  ))
);

drop policy if exists "Comments are public" on public.comments;
create policy "Comments are public" on public.comments for select using (true);
drop policy if exists "Signed-in users comment" on public.comments;
create policy "Signed-in users comment" on public.comments for insert to authenticated with check (author_id = auth.uid());

drop policy if exists "Likes are public" on public.post_likes;
create policy "Likes are public" on public.post_likes for select using (true);
drop policy if exists "Users manage own likes" on public.post_likes;
create policy "Users manage own likes" on public.post_likes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages" on public.messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "Users send messages to owner or owner replies" on public.messages;
create policy "Users send messages to owner or owner replies" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and (
    exists (select 1 from public.profiles p where p.id = recipient_id and p.github_login = 'Nikita83USSR')
    or is_society_owner()
  )
);
drop policy if exists "Recipients mark messages read" on public.messages;
create policy "Recipients mark messages read" on public.messages for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Public image delivery; uploads are restricted to a folder named with the authenticated user's UUID.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('society-images', 'society-images', true, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 8388608, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Society images are public" on storage.objects;
create policy "Society images are public" on storage.objects for select using (bucket_id = 'society-images');
drop policy if exists "Users upload own Society images" on storage.objects;
create policy "Users upload own Society images" on storage.objects for insert to authenticated with check (
  bucket_id = 'society-images' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Users delete own Society images" on storage.objects;
create policy "Users delete own Society images" on storage.objects for delete to authenticated using (
  bucket_id = 'society-images' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Optional realtime for live posts and messages: enable these tables in Supabase Dashboard > Database > Publications > supabase_realtime.
