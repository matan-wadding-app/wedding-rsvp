-- Migration: add email column to guests and confirm category column exists.
-- Run once in Supabase SQL Editor (or via supabase db push if using CLI).

begin;

-- Add email column (nullable, no uniqueness constraint — same guest may share an email)
alter table public.guests
  add column if not exists email text;

-- Index for email lookups (optional, for admin searches)
create index if not exists idx_guests_email on public.guests(email)
  where email is not null;

-- The 'category' column already exists with default 'אתר ציבורי' (see bootstrap-all.sql).
-- No change needed; this comment documents it for reference.

-- Allow admins to query by email (existing RLS policy "guests_admin_all" covers INSERT/UPDATE/DELETE already)
-- No new policy needed.

commit;
