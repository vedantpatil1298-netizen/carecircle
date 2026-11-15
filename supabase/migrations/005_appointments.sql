create index appointments_profile_time_idx
  on carecircle_private.appointments (profile_id, scheduled_at);

create function public.carecircle_upcoming_appointments(p_token text, p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform carecircle_private.check_server(p_token);
  return coalesce((
    select jsonb_agg(to_jsonb(upcoming) order by upcoming.scheduled_at, upcoming.id)
    from (
      select id, doctor_name, location, scheduled_at, notes
      from carecircle_private.appointments
      where profile_id = p_profile_id and scheduled_at >= now()
      order by scheduled_at, id
      limit 50
    ) upcoming
  ), '[]'::jsonb);
end;
$$;

create function public.carecircle_write_appointment(
  p_token text, p_profile_id uuid, p_role text, p_action text, p_id uuid,
  p_doctor text, p_location text, p_scheduled_at timestamptz, p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform carecircle_private.check_server(p_token);
  if p_role is null or p_role not in ('elder', 'caretaker', 'family')
    or p_action is null or p_action not in ('add', 'edit', 'remove')
    or (p_role = 'family' and p_action <> 'add') then
    raise exception using errcode = '42501', message = 'Access denied';
  end if;

  if p_action <> 'remove' and (
    p_scheduled_at is null or p_scheduled_at <= now() or
    p_doctor is null or char_length(trim(p_doctor)) not between 1 and 100 or
    coalesce(char_length(p_location), 0) > 160 or coalesce(char_length(p_notes), 0) > 400
  ) then raise exception 'Invalid appointment details'; end if;

  if p_action = 'add' then
    perform 1 from carecircle_private.profiles where id = p_profile_id for update;
    if (select count(*) from carecircle_private.appointments
        where profile_id = p_profile_id and scheduled_at >= now()) >= 50 then
      raise exception 'Appointment limit reached';
    end if;

    insert into carecircle_private.appointments (profile_id, doctor_name, location, scheduled_at, notes)
    values (p_profile_id, p_doctor, p_location, p_scheduled_at, p_notes);
  elsif p_action = 'edit' then
    update carecircle_private.appointments
    set doctor_name = p_doctor, location = p_location, scheduled_at = p_scheduled_at, notes = p_notes
    where id = p_id and profile_id = p_profile_id and scheduled_at >= now();
    if not found then raise exception 'Appointment unavailable'; end if;
  else
    delete from carecircle_private.appointments
    where id = p_id and profile_id = p_profile_id and scheduled_at >= now();
    if not found then raise exception 'Appointment unavailable'; end if;
  end if;
end;
$$;

revoke execute on function public.carecircle_upcoming_appointments(text,uuid) from public, anon, authenticated;
revoke execute on function public.carecircle_write_appointment(text,uuid,text,text,uuid,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.carecircle_upcoming_appointments(text,uuid) to anon;
grant execute on function public.carecircle_write_appointment(text,uuid,text,text,uuid,text,text,timestamptz,text) to anon;
