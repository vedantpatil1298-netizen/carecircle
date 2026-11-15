create or replace function public.carecircle_change_medication(
  p_token text, p_profile_id uuid, p_role text, p_operation text, p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous jsonb;
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

    if p_operation in ('edit', 'remove') then
      select jsonb_build_object('name', m.name, 'dosage', m.dosage, 'times', m.times)
      into v_previous
      from carecircle_private.medications m
      where m.profile_id = p_profile_id and m.id = (p_payload->>'id')::uuid and m.active;
      if not found then raise exception 'The medication schedule has already changed'; end if;
      p_payload := p_payload || jsonb_build_object('previous', v_previous);
      if p_operation = 'remove' then
        p_payload := p_payload || jsonb_build_object('name', v_previous->>'name');
      end if;
    end if;

    insert into carecircle_private.pending_changes (profile_id, requested_by_role, change_type, payload)
    values (p_profile_id, 'caretaker', p_operation, p_payload);
  end if;
end;
$$;

create function public.carecircle_chat_budget(p_token text, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform carecircle_private.check_server(p_token);
  perform carecircle_private.check_limit(p_profile_id::text, 'chat', 3600, 12);
  perform carecircle_private.check_limit('app', 'chat', 3600, 120);
end;
$$;

revoke execute on function public.carecircle_chat_budget(text,uuid) from public, anon, authenticated;
grant execute on function public.carecircle_chat_budget(text,uuid) to anon;
