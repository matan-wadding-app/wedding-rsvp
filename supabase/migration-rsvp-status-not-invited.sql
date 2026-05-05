-- RSVP semantics: not_invited = invite not sent yet; pending = invite sent, awaiting RSVP answer.
-- Run once in Supabase SQL Editor on existing projects.

begin;

alter table public.guests
  drop constraint if exists guests_rsvp_status_check;

alter table public.guests
  add constraint guests_rsvp_status_check
  check (rsvp_status in ('not_invited', 'pending', 'coming', 'not_coming'));

alter table public.guests
  alter column rsvp_status set default 'not_invited';

-- Optional: existing rows stay as-is (pending keeps meaning "invited, no answer" for legacy data).

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

  if lower(trim(coalesce(p_rsvp_status, ''))) not in ('not_invited', 'pending', 'coming', 'not_coming') then
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

grant execute on function public.submit_rsvp_by_token(text, text, integer, text) to anon;
grant execute on function public.submit_rsvp_manual(text, text, text, integer, text) to anon;

notify pgrst, 'reload schema';

commit;
