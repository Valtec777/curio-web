-- CURIÓ · correções: quiz objetivo automático; produção aberta continua humana.

alter table public.notebook_assignments
  add column if not exists score numeric;

alter table public.notebook_assignments drop constraint if exists notebook_assignments_score_check;
alter table public.notebook_assignments
  add constraint notebook_assignments_score_check
  check (score is null or (score >= 0 and score <= 100));

create or replace function public.grade_objective_mission_submission(
  p_submission_id uuid,
  p_student_id uuid
)
returns table(auto_reviewed integer, needs_teacher integer, score_percent numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_mission_student_id uuid;
  v_allowed boolean := false;
  v_auto integer := 0;
  v_pending integer := 0;
  v_avg numeric := null;
begin
  if v_user is null then raise exception 'authentication required'; end if;

  select exists (
    select 1 from public.students s
    where s.id = p_student_id
      and s.deleted_at is null
      and s.auth_user_id = v_user
  ) or private.guardian_has_student(p_student_id)
  into v_allowed;

  if not v_allowed then raise exception 'student access required'; end if;

  select s.mission_student_id into v_mission_student_id
  from public.submissions s
  join public.mission_students ms on ms.id = s.mission_student_id
  where s.id = p_submission_id
    and s.student_id = p_student_id
    and ms.student_id = p_student_id
  limit 1;

  if v_mission_student_id is null then raise exception 'submission unavailable'; end if;

  update public.answers a
  set score = case
        when lower(btrim(coalesce(a.answer_text,''))) = lower(btrim(k.correct_value)) then 1
        else 0
      end,
      reviewed_at = now(),
      reviewed_by_teacher_id = null
  from public.mission_questions q
  join public.mission_question_answer_keys k on k.question_id = q.id
  where a.submission_id = p_submission_id
    and a.question_id = q.id
    and q.question_type in ('multiple_choice','true_false')
    and a.reviewed_at is null;

  get diagnostics v_auto = row_count;

  select count(*)::integer into v_pending
  from public.answers a
  where a.submission_id = p_submission_id
    and a.reviewed_at is null;

  select round(avg(a.score) * 100, 2) into v_avg
  from public.answers a
  where a.submission_id = p_submission_id
    and a.score is not null;

  update public.mission_students
  set status = case when v_pending = 0 then 'reviewed'::public.assignment_status else 'submitted'::public.assignment_status end,
      progress_percent = 100,
      completed_at = case when v_pending = 0 then coalesce(completed_at, now()) else completed_at end,
      after_score = v_avg
  where id = v_mission_student_id;

  update public.submissions
  set review_status = case when v_pending = 0 then 'reviewed' else 'pending' end,
      reviewed_at = case when v_pending = 0 then coalesce(reviewed_at, now()) else reviewed_at end
  where id = p_submission_id;

  return query select v_auto, v_pending, v_avg;
end;
$$;

revoke all on function public.grade_objective_mission_submission(uuid,uuid) from public, anon;
grant execute on function public.grade_objective_mission_submission(uuid,uuid) to authenticated;
