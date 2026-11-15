create function carecircle_private.add_sample_medications(p_profile_id uuid)
returns void
language sql
set search_path = ''
as $$
  insert into carecircle_private.medications (
    profile_id, name, dosage, instructions, times, days, start_date, effective_from
  )
  select p_profile_id, sample.name, 'Practice dose',
    'Fictional medication for testing the care log. Do not take.',
    array[sample.at], array[0,1,2,3,4,5,6]::smallint[],
    (now() at time zone 'Asia/Kolkata')::date,
    date_trunc('day', now(), 'Asia/Kolkata')
  from (values
    ('Sample medication · Morning', time '08:00'),
    ('Sample medication · Afternoon', time '13:00'),
    ('Sample medication · Evening', time '20:00')
  ) as sample(name, at)
  where not exists (
    select 1 from carecircle_private.medications where profile_id = p_profile_id
  );
$$;

create function carecircle_private.add_sample_medications_on_create()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform carecircle_private.add_sample_medications(new.id);
  return new;
end;
$$;

revoke execute on function carecircle_private.add_sample_medications(uuid) from public, anon, authenticated;
revoke execute on function carecircle_private.add_sample_medications_on_create() from public, anon, authenticated;

create trigger carecircle_sample_medications_after_profile_insert
after insert on carecircle_private.profiles
for each row execute function carecircle_private.add_sample_medications_on_create();

select carecircle_private.add_sample_medications(p.id)
from carecircle_private.profiles p
where not exists (
  select 1 from carecircle_private.medications m where m.profile_id = p.id
);
