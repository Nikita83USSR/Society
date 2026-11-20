-- Society: fix owner-only post editing permissions.
-- Run this entire script in Supabase SQL Editor.
drop policy if exists "Owner edits own posts" on public.posts;
create policy "Owner edits own posts"
on public.posts
for update
to authenticated
using (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and lower(p.github_login) = lower('Nikita83USSR')
  )
)
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and lower(p.github_login) = lower('Nikita83USSR')
  )
);
grant select, update on public.posts to authenticated;
