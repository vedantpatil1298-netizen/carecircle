alter table carecircle_private.profiles
  add column age smallint check (age between 1 and 120),
  add column gender text check (gender in ('woman', 'man', 'non-binary', 'self-described', 'prefer-not-to-say'));

create table carecircle_private.care_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references carecircle_private.profiles on delete cascade,
  role carecircle_private.care_role not null,
  email text not null,
  is_owner boolean not null default false check (not is_owner or role <> 'elder'),
  password_hash text,
  verified_at timestamptz,
  invite_hash text unique,
  invite_expires_at timestamptz,
  unique (profile_id, role),
  unique (profile_id, email)
);

create unique index carecircle_verified_email_idx
  on carecircle_private.care_accounts (email) where verified_at is not null;

create table carecircle_private.enrollments (
  invite_hash text primary key,
  expires_at timestamptz not null,
  details jsonb not null
);

create function public.carecircle_start_enrollment(
  p_token text, p_client text, p_address_hash text, p_hash text, p_details jsonb
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform carecircle_private.check_server(p_token);
  perform carecircle_private.check_limit(p_client, 'enrollment', 3600, 8);
  perform carecircle_private.check_limit(p_address_hash, 'enrollment-email', 3600, 4);
  if p_details->>'owner_role' is null or p_details->>'owner_role' not in ('caretaker', 'family') then
    raise exception 'Choose a caretaker or family member';
  end if;
  delete from carecircle_private.enrollments where expires_at < now();
  insert into carecircle_private.enrollments (invite_hash, expires_at, details)
  values (p_hash, now() + interval '1 hour', p_details);
end;
$$;

create function public.carecircle_finish_enrollment(p_token text, p_hash text, p_password_hash text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_details jsonb;
  v_profile uuid;
  v_account carecircle_private.care_accounts%rowtype;
begin
  perform carecircle_private.check_server(p_token);

  delete from carecircle_private.enrollments
  where invite_hash = p_hash and expires_at > now()
  returning details into v_details;

  if v_details is not null then
    insert into carecircle_private.profiles (elder_name, age, gender)
    values (v_details->>'name', (v_details->>'age')::smallint, v_details->>'gender')
    returning id into v_profile;

    insert into carecircle_private.care_accounts (profile_id, role, email, is_owner, password_hash, verified_at)
    select v_profile, roles.key::carecircle_private.care_role, roles.value,
      roles.key = v_details->>'owner_role',
      case when roles.key = v_details->>'owner_role' then p_password_hash end,
      case when roles.key = v_details->>'owner_role' then now() end
    from jsonb_each_text(v_details->'emails') roles
    where roles.value is not null and roles.value <> '';

    insert into carecircle_private.contacts (profile_id, role, email)
    select profile_id, role, email from carecircle_private.care_accounts where profile_id = v_profile;

    select * into v_account from carecircle_private.care_accounts
    where profile_id = v_profile and is_owner;
  else
    update carecircle_private.care_accounts
      set password_hash = p_password_hash, verified_at = now(), invite_hash = null, invite_expires_at = null
      where invite_hash = p_hash and invite_expires_at > now() and verified_at is null
      returning * into v_account;
  end if;

  if v_account.id is null then return null; end if;
  return jsonb_build_object('id', v_account.id, 'profile_id', v_account.profile_id, 'role', v_account.role);
end;
$$;

create function public.carecircle_password_account(p_token text, p_client text, p_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform carecircle_private.check_server(p_token);
  perform carecircle_private.check_limit(p_client, 'password-login', 900, 15);
  return (
    select jsonb_build_object('id', id, 'profile_id', profile_id, 'role', role, 'password_hash', password_hash)
    from carecircle_private.care_accounts
    where email = p_email and verified_at is not null
  );
end;
$$;

create function public.carecircle_account_roster(p_token text, p_profile_id uuid, p_account_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform carecircle_private.check_server(p_token);
  if not exists (select 1 from carecircle_private.care_accounts
    where id = p_account_id and profile_id = p_profile_id and verified_at is not null) then
    return null;
  end if;
  return (select jsonb_build_object(
    'can_invite', owner.is_owner,
    'members', (
      select jsonb_agg(jsonb_build_object('id', id, 'role', role, 'verified', verified_at is not null) order by role)
      from carecircle_private.care_accounts where profile_id = p_profile_id
    )
  ) from carecircle_private.care_accounts owner where owner.id = p_account_id);
end;
$$;

create function public.carecircle_invite_account(
  p_token text, p_profile_id uuid, p_account_id uuid, p_target uuid, p_hash text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_email text;
begin
  perform carecircle_private.check_server(p_token);
  if not exists (select 1 from carecircle_private.care_accounts
    where id = p_account_id and profile_id = p_profile_id and is_owner and verified_at is not null) then
    raise exception using errcode = '42501', message = 'Access denied';
  end if;
  perform carecircle_private.check_limit(p_target::text, 'account-invite', 3600, 4);
  update carecircle_private.care_accounts
    set invite_hash = p_hash, invite_expires_at = now() + interval '1 hour'
    where id = p_target and profile_id = p_profile_id and verified_at is null
    returning email into v_email;
  return v_email;
end;
$$;

revoke execute on function public.carecircle_start_enrollment(text,text,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.carecircle_finish_enrollment(text,text,text) from public, anon, authenticated;
revoke execute on function public.carecircle_password_account(text,text,text) from public, anon, authenticated;
revoke execute on function public.carecircle_account_roster(text,uuid,uuid) from public, anon, authenticated;
revoke execute on function public.carecircle_invite_account(text,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.carecircle_start_enrollment(text,text,text,text,jsonb) to anon;
grant execute on function public.carecircle_finish_enrollment(text,text,text) to anon;
grant execute on function public.carecircle_password_account(text,text,text) to anon;
grant execute on function public.carecircle_account_roster(text,uuid,uuid) to anon;
grant execute on function public.carecircle_invite_account(text,uuid,uuid,uuid,text) to anon;

-- Verified profiles only use accounts. The older test profiles already have scoped passcodes.
create or replace function public.carecircle_join(p_token text, p_client_hash text, p_code_hash text)
returns table (profile_id uuid, role text)
language plpgsql security definer set search_path = ''
as $$
begin
  perform carecircle_private.check_server(p_token);
  perform carecircle_private.check_limit(p_client_hash, 'join', 60, 30);
  return query
    select codes.profile_id, codes.role::text
    from carecircle_private.passcodes codes
    where codes.code_hash = p_code_hash
      and not exists (select 1 from carecircle_private.care_accounts a where a.profile_id = codes.profile_id);
end;
$$;

create function public.carecircle_check_verify_link(p_token text, p_client text, p_hash text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  perform carecircle_private.check_server(p_token);
  perform carecircle_private.check_limit(p_client, 'verify-link', 900, 20);
  return exists (select 1 from carecircle_private.enrollments where invite_hash = p_hash and expires_at > now())
    or exists (select 1 from carecircle_private.care_accounts
      where invite_hash = p_hash and invite_expires_at > now() and verified_at is null);
end;
$$;
revoke execute on function public.carecircle_check_verify_link(text,text,text) from public, anon, authenticated;
grant execute on function public.carecircle_check_verify_link(text,text,text) to anon;
