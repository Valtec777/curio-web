-- CURIÓ · experiência do aluno
-- Estrutura, regras e RPCs. O catálogo inicial fica na migration 056.

alter table public.achievements
  add column if not exists unlock_hint text,
  add column if not exists sort_order integer not null default 0;

create table if not exists public.achievement_rules (
  achievement_id uuid primary key references public.achievements(id) on delete cascade,
  rule_type text not null check (rule_type in (
    'reviewed_missions','notebooks_submitted','streak_days','stars','improvements',
    'perfect_missions','distinct_subjects','courses_completed','active_days','open_answers'
  )),
  threshold integer not null check (threshold > 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.achievement_rules enable row level security;
drop policy if exists achievement_rules_read on public.achievement_rules;
create policy achievement_rules_read on public.achievement_rules for select to authenticated using (true);
drop policy if exists achievement_rules_admin_write on public.achievement_rules;
create policy achievement_rules_admin_write on public.achievement_rules for all to authenticated
using (private.has_role('admin'::app_role)) with check (private.has_role('admin'::app_role));

create or replace function public.submit_student_notebook_assignment(p_assignment_id uuid, p_file_path text)
returns void language plpgsql security definer set search_path=public,private,storage,pg_temp as $$
declare v_student_id uuid; v_activity_id uuid;
begin
  select n.student_id,n.activity_id into v_student_id,v_activity_id from public.notebook_assignments n where n.id=p_assignment_id;
  if v_student_id is null or not exists(select 1 from public.students s where s.id=v_student_id and s.auth_user_id=auth.uid() and s.deleted_at is null) then
    raise exception 'Atividade não disponível para este aluno.';
  end if;
  if not exists(select 1 from public.notebook_activities a where a.id=v_activity_id and a.status='published' and (a.publish_at is null or a.publish_at<=now())) then
    raise exception 'Esta atividade ainda não está disponível.';
  end if;
  if coalesce(p_file_path,'')='' or split_part(p_file_path,'/',1)<>auth.uid()::text then raise exception 'Arquivo inválido.'; end if;
  update public.notebook_assignments set status='submitted',submitted_at=now(),submission_photo_path=p_file_path,submitted_by_user_id=auth.uid(),needs_redo=false,redo_note=null,teacher_note=null,score=null,stars_awarded=0,updated_at=now() where id=p_assignment_id;
end; $$;
revoke all on function public.submit_student_notebook_assignment(uuid,text) from public,anon;
grant execute on function public.submit_student_notebook_assignment(uuid,text) to authenticated;

create or replace function public.refresh_student_achievements(p_student_id uuid)
returns integer language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_reviewed_missions int:=0; v_notebooks_submitted int:=0;
  v_streak int:=0; v_stars int:=0; v_improvements int:=0; v_perfect int:=0;
  v_subjects int:=0; v_courses int:=0; v_active_days int:=0; v_open_answers int:=0; v_inserted int:=0;
begin
  if v_uid is null then raise exception 'Sessão obrigatória.'; end if;
  if not (exists(select 1 from public.students s where s.id=p_student_id and s.auth_user_id=v_uid and s.deleted_at is null)
    or private.has_role('admin'::app_role) or private.teacher_has_student(p_student_id) or private.guardian_can_view_progress(p_student_id)) then
    raise exception 'Sem acesso a este aluno.';
  end if;

  select count(*) filter(where status='reviewed'),
         count(*) filter(where before_score is not null and after_score is not null and after_score>before_score),
         count(*) filter(where after_score>=100)
    into v_reviewed_missions,v_improvements,v_perfect
    from public.mission_students where student_id=p_student_id;

  select count(*) into v_notebooks_submitted from public.notebook_assignments where student_id=p_student_id and submitted_at is not null;
  select coalesce(streak_days,0),coalesce(stars,0) into v_streak,v_stars from public.student_game_profiles where student_id=p_student_id;
  v_streak:=coalesce(v_streak,0); v_stars:=coalesce(v_stars,0);

  select count(distinct subject_id) into v_subjects from (
    select m.subject_id from public.mission_students ms join public.missions m on m.id=ms.mission_id where ms.student_id=p_student_id and ms.status='reviewed' and m.subject_id is not null
    union all
    select a.subject_id from public.notebook_assignments na join public.notebook_activities a on a.id=na.activity_id where na.student_id=p_student_id and na.submitted_at is not null and a.subject_id is not null
  ) q;

  select count(*) into v_courses from public.free_course_enrollments where student_id=p_student_id and status='completed';
  select count(distinct activity_day) into v_active_days from (
    select completed_at::date as activity_day from public.mission_students where student_id=p_student_id and completed_at is not null
    union all
    select submitted_at::date as activity_day from public.notebook_assignments where student_id=p_student_id and submitted_at is not null
  ) d where activity_day is not null;

  select count(*) into v_open_answers from public.answers ans
    join public.submissions sub on sub.id=ans.submission_id
    join public.mission_questions q on q.id=ans.question_id
    where sub.student_id=p_student_id and length(trim(coalesce(ans.answer_text,'')))>0
      and q.question_type in ('open','open_text','discursive','essay');

  with metrics(rule_type,value) as (values
    ('reviewed_missions',v_reviewed_missions),('notebooks_submitted',v_notebooks_submitted),('streak_days',v_streak),('stars',v_stars),
    ('improvements',v_improvements),('perfect_missions',v_perfect),('distinct_subjects',v_subjects),('courses_completed',v_courses),
    ('active_days',v_active_days),('open_answers',v_open_answers)
  ), ins as (
    insert into public.student_achievements(student_id,achievement_id,earned_at,source_type)
    select p_student_id,r.achievement_id,now(),'automatic' from public.achievement_rules r
      join metrics m on m.rule_type=r.rule_type join public.achievements a on a.id=r.achievement_id and a.active=true
    where m.value>=r.threshold on conflict(student_id,achievement_id) do nothing returning 1
  ) select count(*) into v_inserted from ins;
  return v_inserted;
end; $$;
revoke all on function public.refresh_student_achievements(uuid) from public,anon;
grant execute on function public.refresh_student_achievements(uuid) to authenticated;
