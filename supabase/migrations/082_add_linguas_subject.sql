insert into public.subjects (name, active)
select 'Línguas', true
where not exists (
  select 1
  from public.subjects
  where lower(name) = lower('Línguas')
);
