-- RSVP global deadline, per-guest override window, send timestamps.
-- Run after migration-security-hardening-public-rpc.sql (or merge grants with that file's pattern).

begin;

-- ---------------------------------------------------------------------------
-- event_settings (single row id = 1)
-- ---------------------------------------------------------------------------
create table if not exists public.event_settings (
  id integer primary key check (id = 1),
  rsvp_deadline_enabled boolean not null default false,
  rsvp_deadline_at timestamptz
);

insert into public.event_settings (id, rsvp_deadline_enabled, rsvp_deadline_at)
values (1, false, null)
on conflict (id) do nothing;

alter table public.event_settings enable row level security;

drop policy if exists "event_settings_admin_all" on public.event_settings;
create policy "event_settings_admin_all"
on public.event_settings
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

-- ---------------------------------------------------------------------------
-- guests: send + override columns
-- ---------------------------------------------------------------------------
alter table public.guests add column if not exists initial_invite_sent_at timestamptz;
alter table public.guests add column if not exists gift_reminder_sent_at timestamptz;
alter table public.guests add column if not exists rsvp_override_until timestamptz;

-- ---------------------------------------------------------------------------
-- Public guest RPC: extended payload + computed rsvp_closed
-- ---------------------------------------------------------------------------
drop function if exists public.get_guest_by_token(text);
create or replace function public.get_guest_by_token(p_token text)
returns table(
  id uuid,
  token text,
  full_name text,
  phone text,
  category text,
  invite_side text,
  rsvp_status text,
  guests_count integer,
  notes text,
  responded_at timestamptz,
  created_at timestamptz,
  initial_invite_sent_at timestamptz,
  gift_reminder_sent_at timestamptz,
  rsvp_override_until timestamptz,
  rsvp_deadline_enabled boolean,
  rsvp_deadline_at timestamptz,
  rsvp_closed boolean
)
language sql
security definer
set search_path = public
as $$
  with cleaned as (
    select lower(trim(coalesce(p_token, ''))) as token
  )
  select
    g.id,
    g.token,
    g.full_name,
    g.phone,
    g.category,
    g.invite_side,
    g.rsvp_status,
    g.guests_count,
    g.notes,
    g.responded_at,
    g.created_at,
    g.initial_invite_sent_at,
    g.gift_reminder_sent_at,
    g.rsvp_override_until,
    coalesce(
      (select es0.rsvp_deadline_enabled from public.event_settings es0 where es0.id = 1),
      false
    ) as rsvp_deadline_enabled,
    (select es0.rsvp_deadline_at from public.event_settings es0 where es0.id = 1) as rsvp_deadline_at,
    (
      case
        when not coalesce(
          (select es0.rsvp_deadline_enabled from public.event_settings es0 where es0.id = 1),
          false
        )
          or (select es0.rsvp_deadline_at from public.event_settings es0 where es0.id = 1) is null then false
        when now() <= (select es0.rsvp_deadline_at from public.event_settings es0 where es0.id = 1) then false
        when g.rsvp_override_until is not null and now() <= g.rsvp_override_until then false
        else true
      end
    ) as rsvp_closed
  from public.guests g
  cross join cleaned c
  where c.token ~ '^[0-9a-f]{16}$'
    and g.token = c.token
  limit 1;
$$;

drop function if exists public.submit_rsvp_by_token(text, text, integer, text);
create or replace function public.submit_rsvp_by_token(
  p_token text,
  p_rsvp_status text,
  p_guests_count integer,
  p_notes text default null
)
returns public.guests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.guests;
  v_status text;
  v_guests_count integer;
  v_token text;
  v_enabled boolean;
  v_deadline timestamptz;
  v_override timestamptz;
begin
  v_token := lower(trim(coalesce(p_token, '')));
  if v_token !~ '^[0-9a-f]{16}$' then
    raise exception 'Invalid token format';
  end if;

  select
    coalesce(es.rsvp_deadline_enabled, false),
    es.rsvp_deadline_at
  into v_enabled, v_deadline
  from public.event_settings es
  where es.id = 1;

  select g.rsvp_override_until into v_override
  from public.guests g
  where g.token = v_token
  limit 1;

  if coalesce(v_enabled, false) and v_deadline is not null and now() > v_deadline then
    if v_override is null or now() > v_override then
      raise exception 'RSVP deadline has passed';
    end if;
  end if;

  v_status := lower(trim(coalesce(p_rsvp_status, '')));
  if v_status not in ('coming', 'not_coming') then
    raise exception 'Invalid RSVP status';
  end if;

  if v_status = 'not_coming' then
    v_guests_count := 0;
  else
    v_guests_count := least(greatest(coalesce(p_guests_count, 1), 0), 8);
  end if;

  update public.guests g
  set
    rsvp_status = v_status,
    guests_count = v_guests_count,
    notes = coalesce(p_notes, g.notes),
    responded_at = now()
  where g.token = v_token
  returning g.* into v_row;

  if v_row.id is null then
    raise exception 'Guest not found';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs (JWT must be admin email)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_rsvp_deadline(
  p_enabled boolean,
  p_deadline_local text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ts timestamptz;
begin
  if not public.is_admin_user() then
    raise exception 'Unauthorized';
  end if;

  if coalesce(p_enabled, false) then
    if coalesce(length(trim(coalesce(p_deadline_local, ''))), 0) = 0 then
      raise exception 'Deadline datetime required when RSVP deadline is enabled';
    end if;
    begin
      v_ts := (trim(p_deadline_local)::timestamp AT TIME ZONE 'Asia/Jerusalem');
    exception when others then
      raise exception 'Invalid deadline datetime (expected YYYY-MM-DD HH:MI in Jerusalem)';
    end;
    update public.event_settings e
    set rsvp_deadline_enabled = true, rsvp_deadline_at = v_ts
    where e.id = 1;
  else
    update public.event_settings e
    set rsvp_deadline_enabled = false, rsvp_deadline_at = null
    where e.id = 1;
  end if;
end;
$$;

create or replace function public.admin_grant_rsvp_override(p_guest_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz := now() + interval '12 hours';
  v_gid uuid;
begin
  if not public.is_admin_user() then
    raise exception 'Unauthorized';
  end if;

  update public.guests g
  set rsvp_override_until = v_until
  where g.id = p_guest_id
  returning g.id into v_gid;

  if v_gid is null then
    raise exception 'Guest not found';
  end if;

  return v_until;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (match migration-security-hardening-public-rpc pattern)
-- ---------------------------------------------------------------------------
grant execute on function public.get_guest_by_token(text) to anon;
grant execute on function public.submit_rsvp_by_token(text, text, integer, text) to anon;

revoke execute on function public.get_guest_by_token(text) from public;
revoke execute on function public.submit_rsvp_by_token(text, text, integer, text) from public;
revoke execute on function public.get_guest_by_token(text) from authenticated;
revoke execute on function public.submit_rsvp_by_token(text, text, integer, text) from authenticated;

grant execute on function public.admin_set_rsvp_deadline(boolean, text) to authenticated;
grant execute on function public.admin_grant_rsvp_override(uuid) to authenticated;

revoke execute on function public.admin_set_rsvp_deadline(boolean, text) from public;
revoke execute on function public.admin_grant_rsvp_override(uuid) from public;
revoke execute on function public.admin_set_rsvp_deadline(boolean, text) from anon;
revoke execute on function public.admin_grant_rsvp_override(uuid) from anon;

notify pgrst, 'reload schema';

commit;
