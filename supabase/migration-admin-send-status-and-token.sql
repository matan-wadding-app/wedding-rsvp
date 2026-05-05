-- Admin: server-side send timestamps (not browser clock), bulk send status, regenerate guest token.

begin;

create or replace function public.admin_patch_guest_send_status(
  p_guest_id uuid,
  p_kind text,
  p_mark_sent boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Unauthorized';
  end if;

  if lower(trim(coalesce(p_kind, ''))) not in ('invite', 'gift') then
    raise exception 'Invalid send kind';
  end if;

  if lower(trim(coalesce(p_kind, ''))) = 'invite' then
    update public.guests g
    set
      initial_invite_sent_at = case when p_mark_sent then now() else null end,
      rsvp_status = case
        when p_mark_sent and g.rsvp_status = 'not_invited' then 'pending'
        when not p_mark_sent and g.rsvp_status = 'pending' then 'not_invited'
        else g.rsvp_status
      end
    where g.id = p_guest_id;
  else
    update public.guests g
    set gift_reminder_sent_at = case when p_mark_sent then now() else null end
    where g.id = p_guest_id;
  end if;

  if not found then
    raise exception 'Guest not found';
  end if;
end;
$$;

create or replace function public.admin_bulk_patch_guest_send_status(
  p_guest_ids uuid[],
  p_kind text,
  p_mark_sent boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if not public.is_admin_user() then
    raise exception 'Unauthorized';
  end if;

  if p_guest_ids is null or array_length(p_guest_ids, 1) is null then
    return 0;
  end if;

  if lower(trim(coalesce(p_kind, ''))) not in ('invite', 'gift') then
    raise exception 'Invalid send kind';
  end if;

  if lower(trim(coalesce(p_kind, ''))) = 'invite' then
    update public.guests g
    set
      initial_invite_sent_at = case when p_mark_sent then now() else null end,
      rsvp_status = case
        when p_mark_sent and g.rsvp_status = 'not_invited' then 'pending'
        when not p_mark_sent and g.rsvp_status = 'pending' then 'not_invited'
        else g.rsvp_status
      end
    where g.id = any(p_guest_ids);
  else
    update public.guests g
    set gift_reminder_sent_at = case when p_mark_sent then now() else null end
    where g.id = any(p_guest_ids);
  end if;

  get diagnostics v_n = row_count;
  return coalesce(v_n, 0);
end;
$$;

create or replace function public.admin_regenerate_guest_token(p_guest_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tok text;
begin
  if not public.is_admin_user() then
    raise exception 'Unauthorized';
  end if;

  update public.guests g
  set token = encode(gen_random_bytes(8), 'hex')
  where g.id = p_guest_id
  returning g.token into v_tok;

  if v_tok is null then
    raise exception 'Guest not found';
  end if;

  return v_tok;
end;
$$;

grant execute on function public.admin_patch_guest_send_status(uuid, text, boolean) to authenticated;
grant execute on function public.admin_bulk_patch_guest_send_status(uuid[], text, boolean) to authenticated;
grant execute on function public.admin_regenerate_guest_token(uuid) to authenticated;

revoke execute on function public.admin_patch_guest_send_status(uuid, text, boolean) from public;
revoke execute on function public.admin_bulk_patch_guest_send_status(uuid[], text, boolean) from public;
revoke execute on function public.admin_regenerate_guest_token(uuid) from public;
revoke execute on function public.admin_patch_guest_send_status(uuid, text, boolean) from anon;
revoke execute on function public.admin_bulk_patch_guest_send_status(uuid[], text, boolean) from anon;
revoke execute on function public.admin_regenerate_guest_token(uuid) from anon;

notify pgrst, 'reload schema';

commit;
