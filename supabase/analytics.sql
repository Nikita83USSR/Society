-- Minimal first-party analytics for Society.
-- Stores only timestamp, page path, optional post UUID, source category and device class.
-- No IP address, cookies, precise location, full referrer URL or device fingerprint.
create table if not exists public.site_analytics (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  page_path text not null default '/',
  post_id uuid references public.posts(id) on delete set null,
  source text not null default 'direct' check (source in ('direct','vk','telegram','max','x','instagram','search','other')),
  device text not null default 'desktop' check (device in ('mobile','tablet','desktop'))
);
create index if not exists site_analytics_created_at_idx on public.site_analytics(created_at desc);
alter table public.site_analytics enable row level security;
drop policy if exists "Public can record anonymous analytics" on public.site_analytics;
create policy "Public can record anonymous analytics"
on public.site_analytics for insert to anon, authenticated
with check (
  page_path like '/%'
  and length(page_path) <= 200
);
drop policy if exists "Only site owner can read analytics" on public.site_analytics;
create policy "Only site owner can read analytics"
on public.site_analytics for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and lower(p.github_login) = lower('Nikita83USSR')
  )
);
grant insert on public.site_analytics to anon, authenticated;
grant select on public.site_analytics to authenticated;
