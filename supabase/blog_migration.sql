-- Society blog migration
-- Run once in Supabase SQL Editor. Keeps all existing posts and comments.
-- Only the blog owner can create or delete posts. Signed-in readers can comment.
drop policy if exists "Signed-in users publish" on public.posts;
drop policy if exists "Authors or wall owner delete posts" on public.posts;
drop policy if exists "Blog owner publishes posts" on public.posts;
create policy "Blog owner publishes posts" on public.posts
for insert to authenticated
with check (author_id = auth.uid() and public.is_society_owner());

create policy "Blog owner deletes posts" on public.posts
for delete to authenticated
using (author_id = auth.uid() and public.is_society_owner());

-- Remove private messaging access entirely; the blog has no direct messages.
drop policy if exists "Participants read messages" on public.messages;
drop policy if exists "Users send messages to owner or owner replies" on public.messages;
drop policy if exists "Recipients mark messages read" on public.messages;

-- Comments remain readable publicly and writable only by the signed-in commenter.
drop policy if exists "Signed-in users comment" on public.comments;
create policy "Signed-in users comment" on public.comments
for insert to authenticated
with check (author_id = auth.uid());

-- Shared public blog banner setting.
create table if not exists public.site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings" on public.site_settings
for select to anon, authenticated using (true);
drop policy if exists "Blog owner manages site settings" on public.site_settings;
create policy "Blog owner manages site settings" on public.site_settings
for all to authenticated
using (public.is_society_owner())
with check (public.is_society_owner());
