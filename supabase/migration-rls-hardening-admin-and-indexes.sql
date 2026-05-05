-- Run once in Supabase SQL Editor (existing projects).
-- Hardens admin RLS access and adds missing FK index.

begin;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'ic850536@gmail.com',
    'matan.hdmi@gmail.com'
  );
$$;

alter table public.guests enable row level security;
alter table public.questions enable row level security;
alter table public.message_campaigns enable row level security;
alter table public.message_campaign_items enable row level security;

drop policy if exists "guests_admin_all" on public.guests;
create policy "guests_admin_all"
on public.guests
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "questions_admin_all" on public.questions;
create policy "questions_admin_all"
on public.questions
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "message_campaigns_admin_all" on public.message_campaigns;
create policy "message_campaigns_admin_all"
on public.message_campaigns
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "message_campaign_items_admin_all" on public.message_campaign_items;
create policy "message_campaign_items_admin_all"
on public.message_campaign_items
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create index if not exists idx_message_campaign_items_guest_id
on public.message_campaign_items(guest_id);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'profiles'
  ) then
    execute 'alter table public.profiles enable row level security';
    execute 'drop policy if exists "profiles_owner_rw" on public.profiles';
    execute '' ||
      'create policy "profiles_owner_rw" ' ||
      'on public.profiles ' ||
      'for all ' ||
      'to authenticated ' ||
      'using (id = (select auth.uid())) ' ||
      'with check (id = (select auth.uid()))';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
