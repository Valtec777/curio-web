create or replace function private.sync_plan_meeting_feature_copy()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_features jsonb := coalesce(new.features, '[]'::jsonb);
  v_result jsonb := '[]'::jsonb;
  v_item text;
  v_replaced boolean := false;
begin
  if jsonb_typeof(v_features) <> 'array' then
    return new;
  end if;

  for v_item in select jsonb_array_elements_text(v_features)
  loop
    if v_item ~* '^\s*\d+\s+encontros?\s*(por\s+m[eê]s|/\s*m[eê]s|por\s+ciclo)\s*$' then
      if not v_replaced and coalesce(new.meetings_per_month, 0) > 0 then
        v_result := v_result || jsonb_build_array(format('%s encontros por mês', new.meetings_per_month));
        v_replaced := true;
      end if;
    else
      v_result := v_result || jsonb_build_array(v_item);
    end if;
  end loop;

  new.features := v_result;
  return new;
end;
$$;

revoke all on function private.sync_plan_meeting_feature_copy() from public;

drop trigger if exists trg_sync_plan_meeting_feature_copy on public.plans;
create trigger trg_sync_plan_meeting_feature_copy
before insert or update of meetings_per_month, features on public.plans
for each row execute function private.sync_plan_meeting_feature_copy();

update public.plans
set features = features
where jsonb_typeof(coalesce(features, '[]'::jsonb)) = 'array'
  and exists (
    select 1
    from jsonb_array_elements_text(coalesce(features, '[]'::jsonb)) as f(value)
    where f.value ~* '^\s*\d+\s+encontros?\s*(por\s+m[eê]s|/\s*m[eê]s|por\s+ciclo)\s*$'
  );
