-- One-shot bootstrap for a fresh Supabase project.
-- Creates required tables, defaults, RLS policies, and public RPC helpers.
-- Run this file once in Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

-- ================================================================
-- Tables
-- ================================================================
create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  category text not null default 'אתר ציבורי',
  token text not null unique default encode(gen_random_bytes(8), 'hex'),
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending', 'coming', 'not_coming')),
  guests_count integer not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  question_text text not null,
  status text not null default 'pending' check (status in ('pending', 'answered')),
  answer_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_guests_created_at on public.guests(created_at desc);
create index if not exists idx_guests_token on public.guests(token);
create index if not exists idx_questions_created_at on public.questions(created_at desc);
create index if not exists idx_questions_status on public.questions(status);

-- ================================================================
-- RLS
-- ================================================================
alter table public.guests enable row level security;
alter table public.questions enable row level security;

drop policy if exists "guests_admin_all" on public.guests;
drop policy if exists "questions_admin_all" on public.questions;

create policy "guests_admin_all"
on public.guests
for all
to authenticated
using (true)
with check (true);

create policy "questions_admin_all"
on public.questions
for all
to authenticated
using (true)
with check (true);

-- ================================================================
-- Public RPC functions (for guest page)
-- ================================================================
create or replace function public.get_guest_by_token(p_token text)
returns table(
  id uuid,
  token text,
  full_name text,
  phone text,
  category text,
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
  select
    g.id,
    g.token,
    g.full_name,
    g.phone,
    g.category,
    g.rsvp_status,
    g.guests_count,
    g.notes,
    g.responded_at,
    g.created_at
  from public.guests g
  where g.token = p_token
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
begin
  update public.guests g
  set
    rsvp_status = p_rsvp_status,
    guests_count = greatest(coalesce(p_guests_count, 1), 0),
    notes = coalesce(p_notes, g.notes),
    responded_at = now()
  where g.token = p_token
  returning g.* into v_row;

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
  insert into public.guests (
    full_name,
    phone,
    category,
    rsvp_status,
    guests_count
  )
  values (
    p_full_name,
    nullif(p_phone, ''),
    coalesce(nullif(p_category, ''), 'אתר ציבורי'),
    p_rsvp_status,
    greatest(coalesce(p_guests_count, 1), 0)
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
  insert into public.questions (
    guest_name,
    question_text
  )
  values (
    p_guest_name,
    p_question_text
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.get_guest_by_token(text) to anon, authenticated;
grant execute on function public.submit_rsvp_by_token(text, text, integer, text) to anon, authenticated;
grant execute on function public.submit_rsvp_manual(text, text, text, integer, text) to anon, authenticated;
grant execute on function public.submit_question_public(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
