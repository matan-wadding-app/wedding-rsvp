-- Run once in Supabase SQL Editor (existing projects).
-- Hardens public RPCs with validation, DB constraints, and least-privilege grants.

begin;

update public.guests
set guests_count = least(greatest(coalesce(guests_count, 1), 0), 8);

alter table public.guests
  drop constraint if exists guests_guests_count_check;

alter table public.guests
  add constraint guests_guests_count_check
  check (guests_count between 0 and 8);

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
  created_at timestamptz
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
    g.created_at
  from public.guests g
  join cleaned c on true
  where c.token ~ '^[0-9a-f]{16}$'
    and g.token = c.token
  limit 1;
$$;

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
begin
  v_token := lower(trim(coalesce(p_token, '')));
  if v_token !~ '^[0-9a-f]{16}$' then
    raise exception 'Invalid token format';
  end if;

  v_status := lower(trim(coalesce(p_rsvp_status, '')));
  if v_status not in ('pending', 'coming', 'not_coming') then
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

create or replace function public.submit_rsvp_manual(
  p_full_name text,
  p_phone text,
  p_rsvp_status text,
  p_guests_count integer,
  p_category text default 'אתר ציבורי'
)
returns public.guests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.guests;
begin
  if coalesce(length(trim(p_full_name)), 0) < 2 then
    raise exception 'Full name is required';
  end if;

  if lower(trim(coalesce(p_rsvp_status, ''))) not in ('pending', 'coming', 'not_coming') then
    raise exception 'Invalid RSVP status';
  end if;

  insert into public.guests (
    full_name,
    phone,
    category,
    rsvp_status,
    guests_count
  )
  values (
    trim(p_full_name),
    nullif(trim(coalesce(p_phone, '')), ''),
    coalesce(nullif(trim(coalesce(p_category, '')), ''), 'אתר ציבורי'),
    lower(trim(p_rsvp_status)),
    least(greatest(coalesce(p_guests_count, 1), 0), 8)
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.submit_question_public(
  p_guest_name text,
  p_question_text text
)
returns public.questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.questions;
begin
  if coalesce(length(trim(p_guest_name)), 0) < 2 then
    raise exception 'Guest name is required';
  end if;

  if coalesce(length(trim(p_question_text)), 0) < 2 then
    raise exception 'Question text is required';
  end if;

  insert into public.questions (
    guest_name,
    question_text
  )
  values (
    trim(p_guest_name),
    trim(p_question_text)
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.get_guest_by_token(text) to anon;
grant execute on function public.submit_rsvp_by_token(text, text, integer, text) to anon;
grant execute on function public.submit_rsvp_manual(text, text, text, integer, text) to anon;
grant execute on function public.submit_question_public(text, text) to anon;

revoke execute on function public.get_guest_by_token(text) from public;
revoke execute on function public.submit_rsvp_by_token(text, text, integer, text) from public;
revoke execute on function public.submit_rsvp_manual(text, text, text, integer, text) from public;
revoke execute on function public.submit_question_public(text, text) from public;

revoke execute on function public.get_guest_by_token(text) from authenticated;
revoke execute on function public.submit_rsvp_by_token(text, text, integer, text) from authenticated;
revoke execute on function public.submit_rsvp_manual(text, text, text, integer, text) from authenticated;
revoke execute on function public.submit_question_public(text, text) from authenticated;

notify pgrst, 'reload schema';

commit;
