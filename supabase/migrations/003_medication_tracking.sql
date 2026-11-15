alter table carecircle_private.medications
  add column effective_from timestamptz,
  add column effective_until timestamptz;

update carecircle_private.medications
set effective_from = start_date::timestamp at time zone 'Asia/Kolkata'
where effective_from is null;

alter table carecircle_private.medications alter column effective_from set not null;

create index medications_profile_idx on carecircle_private.medications (profile_id);
create index medication_requests_profile_idx on carecircle_private.pending_changes (profile_id, status);

create function carecircle_private.doses_for(
  p_profile_id uuid, p_first date, p_last date
)
returns table (
  medication_id uuid, name text, dosage text, instructions text,
  scheduled_for timestamptz, status text, is_today boolean
)
language sql
stable
set search_path = ''
as $$
  select m.id, m.name, m.dosage, m.instructions, dose.at,
    coalesce(l.status, case when dose.at < now() then 'unconfirmed' else 'upcoming' end),
    day.value::date = (now() at time zone 'Asia/Kolkata')::date
  from carecircle_private.medications m
  cross join generate_series(p_first::timestamp, p_last::timestamp, interval '1 day') day(value)
  cross join unnest(m.times) scheduled(value)
  cross join lateral (select (day.value::date + scheduled.value) at time zone 'Asia/Kolkata' as at) dose
  left join carecircle_private.dose_logs l on l.medication_id = m.id and l.scheduled_for = dose.at
  where m.profile_id = p_profile_id
    and extract(dow from day.value)::smallint = any(m.days)
    and day.value::date >= m.start_date
    and (m.end_date is null or day.value::date <= m.end_date)
    and dose.at >= m.effective_from
    and (m.active or (m.effective_until is not null and dose.at < m.effective_until));
$$;

create function public.carecircle_medication_overview(p_token text, p_profile_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  perform carecircle_private.check_server(p_token);
  return jsonb_build_object(
    'medications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'name', m.name, 'dosage', m.dosage, 'instructions', m.instructions,
        'times', m.times, 'days', m.days, 'start_date', m.start_date, 'end_date', m.end_date
      ) order by m.name, m.id)
      from carecircle_private.medications m where m.profile_id = p_profile_id and m.active
    ), '[]'::jsonb),
    'doses', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.scheduled_for, d.medication_id)
      from carecircle_private.doses_for(p_profile_id, v_today - 6, v_today) d
    ), '[]'::jsonb),
    'requests', case when p_role in ('elder', 'caretaker') then coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'operation', c.change_type, 'payload', c.payload))
      from carecircle_private.pending_changes c where c.profile_id = p_profile_id and c.status = 'pending'
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create function carecircle_private.write_medication(p_profile_id uuid, p_operation text, p_payload jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_today date := (v_now at time zone 'Asia/Kolkata')::date;
  v_target uuid := (p_payload->>'id')::uuid;
  v_start date := greatest(v_today, coalesce((p_payload->>'start_date')::date, v_today));
  v_end date := (p_payload->>'end_date')::date;
begin
  -- Serialize schedule changes and dose logging for this profile.
  perform 1 from carecircle_private.profiles where id = p_profile_id for update;
  v_now := clock_timestamp();
  v_today := (v_now at time zone 'Asia/Kolkata')::date;
  v_start := greatest(v_today, coalesce((p_payload->>'start_date')::date, v_today));

  if p_operation in ('edit', 'remove') then
    update carecircle_private.medications
    set active = false, effective_until = v_now
    where profile_id = p_profile_id and id = v_target and active;
    if not found then raise exception 'The medication schedule has already changed'; end if;
  end if;

  if p_operation in ('add', 'edit') then
    if v_end < v_start then raise exception 'The end date has passed'; end if;
    if (select count(*) from carecircle_private.medications where profile_id = p_profile_id and active) >= 40 then
      raise exception 'Medication limit reached';
    end if;

    insert into carecircle_private.medications (
      profile_id, name, dosage, instructions, times, days, start_date, end_date, effective_from
    ) values (
      p_profile_id, p_payload->>'name', p_payload->>'dosage', p_payload->>'instructions',
      array(select value::time from jsonb_array_elements_text(p_payload->'times')),
      array(select value::smallint from jsonb_array_elements_text(p_payload->'days')),
      v_start, v_end,
      case when p_operation = 'add' then v_start::timestamp at time zone 'Asia/Kolkata' else v_now end
    );
  end if;
end;
$$;

create function public.carecircle_change_medication(
  p_token text, p_profile_id uuid, p_role text, p_operation text, p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform carecircle_private.check_server(p_token);
  if p_role is null or p_role not in ('elder', 'caretaker') or p_operation is null or p_operation not in ('add', 'edit', 'remove') then
    raise exception using errcode = '42501', message = 'Access denied';
  end if;

  if p_role = 'elder' then
    perform carecircle_private.write_medication(p_profile_id, p_operation, p_payload);
  else
    perform 1 from carecircle_private.profiles where id = p_profile_id for update;
    if (select count(*) from carecircle_private.pending_changes
        where profile_id = p_profile_id and status = 'pending') >= 20 then
      raise exception 'Pending change limit reached';
    end if;

    insert into carecircle_private.pending_changes (profile_id, requested_by_role, change_type, payload)
    values (p_profile_id, 'caretaker', p_operation, p_payload);
  end if;
end;
$$;

create function public.carecircle_review_medication_change(
  p_token text, p_profile_id uuid, p_role text, p_request_id uuid, p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request carecircle_private.pending_changes%rowtype;
begin
  perform carecircle_private.check_server(p_token);
  if p_role is distinct from 'elder' then
    raise exception using errcode = '42501', message = 'Access denied';
  end if;
  perform 1 from carecircle_private.profiles where id = p_profile_id for update;
  select * into v_request from carecircle_private.pending_changes
    where profile_id = p_profile_id and id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'The request was already reviewed'; end if;

  if p_approve then
    perform carecircle_private.write_medication(p_profile_id, v_request.change_type, v_request.payload);
  end if;

  update carecircle_private.pending_changes
    set status = case when p_approve then 'approved' else 'rejected' end
    where id = v_request.id;
end;
$$;

create function public.carecircle_log_dose(
  p_token text, p_profile_id uuid, p_role text, p_medication_id uuid, p_scheduled_for timestamptz, p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  perform carecircle_private.check_server(p_token);
  if p_role is null or p_role not in ('elder', 'caretaker') or p_status is null or p_status not in ('taken', 'skipped') then
    raise exception using errcode = '42501', message = 'Access denied';
  end if;

  perform 1 from carecircle_private.profiles where id = p_profile_id for update;
  if p_scheduled_for > clock_timestamp() or not exists (
    select 1 from carecircle_private.doses_for(p_profile_id, v_today, v_today)
    where medication_id = p_medication_id and scheduled_for = p_scheduled_for
  ) then raise exception 'This dose is not available to log'; end if;

  insert into carecircle_private.dose_logs (profile_id, medication_id, scheduled_for, status, taken_at)
  values (p_profile_id, p_medication_id, p_scheduled_for, p_status, case when p_status = 'taken' then clock_timestamp() end)
  on conflict (medication_id, scheduled_for) do nothing;
end;
$$;

revoke execute on function public.carecircle_medication_overview(text,uuid,text) from public, anon, authenticated;
revoke execute on function public.carecircle_change_medication(text,uuid,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.carecircle_review_medication_change(text,uuid,text,uuid,boolean) from public, anon, authenticated;
revoke execute on function public.carecircle_log_dose(text,uuid,text,uuid,timestamptz,text) from public, anon, authenticated;
grant execute on function public.carecircle_medication_overview(text,uuid,text) to anon;
grant execute on function public.carecircle_change_medication(text,uuid,text,text,jsonb) to anon;
grant execute on function public.carecircle_review_medication_change(text,uuid,text,uuid,boolean) to anon;
grant execute on function public.carecircle_log_dose(text,uuid,text,uuid,timestamptz,text) to anon;
