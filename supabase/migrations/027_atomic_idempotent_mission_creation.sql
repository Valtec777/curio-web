-- CURIÓ · Criação atômica/idempotente de Missão Cuca

alter table public.missions
  add column if not exists idempotency_key text,
  add column if not exists request_day date not null default ((now() at time zone 'America/Bahia')::date);

create unique index if not exists missions_teacher_idempotency_day_uidx
  on public.missions(created_by_teacher_id,idempotency_key,request_day)
  where idempotency_key is not null;

create or replace function public.create_teacher_mission(
  p_idempotency_key text,
  p_title text,
  p_objective text,
  p_estimated_minutes integer,
  p_subject_id uuid,
  p_skill_id uuid,
  p_prompt text,
  p_hint text,
  p_question_type text,
  p_options jsonb,
  p_correct_answer text
)
returns uuid
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_teacher_id uuid;
  v_mission_id uuid;
  v_question_id uuid;
  v_request_day date := (now() at time zone 'America/Bahia')::date;
  v_options jsonb := coalesce(p_options,'[]'::jsonb);
begin
  v_teacher_id := private.teacher_id_for_user();
  if v_teacher_id is null then raise exception 'teacher profile required'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;
  if nullif(trim(p_title),'') is null or length(trim(p_title)) < 3 then raise exception 'title required'; end if;
  if nullif(trim(p_objective),'') is null or length(trim(p_objective)) < 5 then raise exception 'objective required'; end if;
  if p_estimated_minutes < 5 or p_estimated_minutes > 180 then raise exception 'invalid estimated minutes'; end if;
  if p_question_type not in ('open_text','multiple_choice','true_false') then raise exception 'invalid question type'; end if;
  if not exists(select 1 from public.skills s where s.id=p_skill_id and s.active=true) then raise exception 'skill unavailable'; end if;
  if p_subject_id is not null and not exists(select 1 from public.subjects s where s.id=p_subject_id and s.active=true) then raise exception 'subject unavailable'; end if;
  if nullif(trim(p_prompt),'') is null then raise exception 'prompt required'; end if;
  if jsonb_typeof(v_options) <> 'array' then raise exception 'options must be an array'; end if;
  if p_question_type='multiple_choice' and jsonb_array_length(v_options) < 2 then raise exception 'multiple choice requires at least two options'; end if;
  if p_question_type='true_false' then v_options := '["Verdadeiro","Falso"]'::jsonb; end if;
  if p_question_type <> 'open_text' and (nullif(trim(p_correct_answer),'') is null or not (v_options ? trim(p_correct_answer))) then
    raise exception 'correct answer must match an option';
  end if;

  select m.id into v_mission_id
  from public.missions m
  where m.created_by_teacher_id=v_teacher_id
    and m.idempotency_key=p_idempotency_key
    and m.request_day=v_request_day
  limit 1;
  if v_mission_id is not null then return v_mission_id; end if;

  insert into public.missions(created_by_teacher_id,title,objective,estimated_minutes,subject_id,status,idempotency_key,request_day)
  values(v_teacher_id,trim(p_title),trim(p_objective),p_estimated_minutes,p_subject_id,'draft',p_idempotency_key,v_request_day)
  returning id into v_mission_id;

  insert into public.mission_questions(mission_id,position,prompt,hint,question_type,options,primary_skill_id)
  values(v_mission_id,1,trim(p_prompt),nullif(trim(p_hint),''),p_question_type,v_options,p_skill_id)
  returning id into v_question_id;

  if p_question_type <> 'open_text' then
    insert into public.mission_question_answer_keys(question_id,correct_value)
    values(v_question_id,trim(p_correct_answer));
  end if;

  return v_mission_id;
exception
  when unique_violation then
    select m.id into v_mission_id
    from public.missions m
    where m.created_by_teacher_id=v_teacher_id
      and m.idempotency_key=p_idempotency_key
      and m.request_day=v_request_day
    limit 1;
    if v_mission_id is null then raise; end if;
    return v_mission_id;
end;
$$;

revoke all on function public.create_teacher_mission(text,text,text,integer,uuid,uuid,text,text,text,jsonb,text) from public;
grant execute on function public.create_teacher_mission(text,text,text,integer,uuid,uuid,text,text,text,jsonb,text) to authenticated;
