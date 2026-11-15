create schema if not exists carecircle_private;
revoke all on schema carecircle_private from public, anon, authenticated;

create table carecircle_private.server_config (
  singleton boolean primary key default true check (singleton),
  token_hash text not null
);

create type carecircle_private.care_role as enum ('elder', 'caretaker', 'family');

create table carecircle_private.profiles (
  id uuid primary key default gen_random_uuid(),
  elder_name text not null check (char_length(elder_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table carecircle_private.passcodes (
  code_hash text primary key,
  profile_id uuid not null references carecircle_private.profiles on delete cascade,
  role carecircle_private.care_role not null,
  unique (profile_id, role)
);

create table carecircle_private.contacts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references carecircle_private.profiles on delete cascade,
  name text,
  email text not null,
  role carecircle_private.care_role not null,
  unique (profile_id, role, email)
);

create table carecircle_private.medications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references carecircle_private.profiles on delete cascade,
  name text not null,
  dosage text not null,
  instructions text,
  times time[] not null check (cardinality(times) > 0),
  days smallint[] not null check (cardinality(days) > 0 and days <@ array[0,1,2,3,4,5,6]::smallint[]),
  start_date date not null,
  end_date date check (end_date >= start_date),
  active boolean not null default true,
  unique (id, profile_id)
);

create table carecircle_private.dose_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null,
  profile_id uuid not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','taken','missed','skipped')),
  taken_at timestamptz,
  unique (medication_id, scheduled_for),
  foreign key (medication_id, profile_id)
    references carecircle_private.medications (id, profile_id) on delete cascade
);

create table carecircle_private.appointments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references carecircle_private.profiles on delete cascade,
  doctor_name text not null,
  location text,
  scheduled_at timestamptz not null,
  notes text
);

create table carecircle_private.pending_changes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references carecircle_private.profiles on delete cascade,
  requested_by_role carecircle_private.care_role not null,
  change_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected'))
);

create table carecircle_private.reminders_sent (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references carecircle_private.profiles on delete cascade,
  kind text not null,
  reference_id uuid not null,
  contact_id uuid not null references carecircle_private.contacts on delete cascade,
  sent_at timestamptz not null default now(),
  unique (profile_id, kind, reference_id, contact_id)
);

create table carecircle_private.access_limits (
  client_hash text not null,
  operation text not null,
  bucket bigint not null,
  attempts integer not null,
  primary key (client_hash, operation)
);

create function carecircle_private.check_server(p_token text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from carecircle_private.server_config
    where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  ) then
    raise exception using errcode = '42501', message = 'Access denied';
  end if;
end;
$$;

create function carecircle_private.check_limit(
  p_client_hash text, p_operation text, p_window integer, p_max integer
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_bucket bigint := floor(extract(epoch from now()) / p_window);
  v_attempts integer;
begin
  insert into carecircle_private.access_limits as limits (client_hash, operation, bucket, attempts)
  values (p_client_hash, p_operation, v_bucket, 1)
  on conflict (client_hash, operation) do update
    set bucket = excluded.bucket,
        attempts = case when limits.bucket = excluded.bucket then limits.attempts + 1 else 1 end
  returning attempts into v_attempts;

  if v_attempts > p_max then
    raise exception using errcode = 'P0001', message = 'Rate limit reached';
  end if;
end;
$$;

create function public.carecircle_create_profile(
  p_token text, p_client_hash text, p_name text, p_caretaker_email text,
  p_family_email text, p_elder_hash text, p_caretaker_hash text, p_family_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform carecircle_private.check_server(p_token);
  perform carecircle_private.check_limit(p_client_hash, 'create', 3600, 12);

  insert into carecircle_private.profiles (elder_name) values (p_name) returning id into v_id;
  insert into carecircle_private.passcodes (profile_id, role, code_hash) values
    (v_id, 'elder', p_elder_hash), (v_id, 'caretaker', p_caretaker_hash), (v_id, 'family', p_family_hash);
  insert into carecircle_private.contacts (profile_id, email, role)
    select v_id, p_caretaker_email, 'caretaker'::carecircle_private.care_role where p_caretaker_email is not null
    union all
    select v_id, p_family_email, 'family'::carecircle_private.care_role where p_family_email is not null;
  return v_id;
end;
$$;

create function public.carecircle_join(p_token text, p_client_hash text, p_code_hash text)
returns table (profile_id uuid, role text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform carecircle_private.check_server(p_token);
  perform carecircle_private.check_limit(p_client_hash, 'join', 60, 30);

  return query
    select codes.profile_id, codes.role::text
    from carecircle_private.passcodes as codes where codes.code_hash = p_code_hash;
end;
$$;

create function public.carecircle_profile(p_token text, p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform carecircle_private.check_server(p_token);
  return (select elder_name from carecircle_private.profiles where id = p_profile_id);
end;
$$;

revoke execute on function public.carecircle_create_profile(text,text,text,text,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.carecircle_join(text,text,text) from public, anon, authenticated;
revoke execute on function public.carecircle_profile(text,uuid) from public, anon, authenticated;
grant execute on function public.carecircle_create_profile(text,text,text,text,text,text,text,text) to anon;
grant execute on function public.carecircle_join(text,text,text) to anon;
grant execute on function public.carecircle_profile(text,uuid) to anon;
