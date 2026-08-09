-- CURIÓ · compatibilidade/fix da função de contexto da IA especialista.
-- Mantida separada porque esta correção também existe no histórico do projeto.
-- Reaplicar é seguro: CREATE OR REPLACE atualiza a função para os nomes reais das colunas.

create or replace function public.build_ai_student_context(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_allowed boolean;
  v_result jsonb;
begin
  v_allowed := private.has_role('admin'::app_role)
    or (private.has_role('teacher'::app_role) and private.teacher_has_student(p_student_id));
  if not v_allowed then raise exception 'not allowed'; end if;

  select jsonb_build_object(
    'student', jsonb_build_object('id',s.id,'preferred_name',s.preferred_name,'grade',g.name,'status',s.status),
    'current_contents', coalesce((
      select jsonb_agg(jsonb_build_object('subject',sub.name,'content',c.name,'confirmed',sc.confirmed,'confidence',sc.confidence,'updated_at',sc.updated_at) order by sc.updated_at desc)
      from public.student_current_contents sc
      left join public.subjects sub on sub.id=sc.subject_id
      left join public.contents c on c.id=sc.content_id
      where sc.student_id=s.id and sc.active=true
    ), '[]'::jsonb),
    'skill_states', coalesce((
      select jsonb_agg(jsonb_build_object('skill',sk.name,'domain_level',st.domain_level,'autonomy_level',st.autonomy_level,'confidence',st.confidence,'trend',st.trend,'priority',st.priority,'diagnostic_label',st.diagnostic_label,'evidence_count',st.evidence_count,'updated_at',st.updated_at) order by st.priority desc,st.updated_at desc)
      from public.student_skill_states st join public.skills sk on sk.id=st.skill_id where st.student_id=s.id
    ), '[]'::jsonb),
    'recent_evidence', coalesce((
      select jsonb_agg(x.obj order by x.observed_at desc) from (
        select e.observed_at,jsonb_build_object('skill_id',e.skill_id,'result_code',e.result_code,'domain_level',e.domain_level,'autonomy_level',e.autonomy_level,'question_difficulty',e.question_difficulty,'evidence_weight',e.evidence_weight,'diagnostic_signal',e.diagnostic_signal,'teacher_confirmed',e.teacher_confirmed,'observed_at',e.observed_at) obj
        from public.pedagogical_evidence e where e.student_id=s.id order by e.observed_at desc limit 20
      ) x
    ), '[]'::jsonb),
    'recent_missions', coalesce((
      select jsonb_agg(x.obj order by x.assigned_at desc) from (
        select ms.assigned_at,jsonb_build_object('mission_title',m.title,'status',ms.status,'progress_percent',ms.progress_percent,'due_at',ms.due_at,'completed_at',ms.completed_at,'before_score',ms.before_score,'after_score',ms.after_score) obj
        from public.mission_students ms join public.missions m on m.id=ms.mission_id where ms.student_id=s.id order by ms.assigned_at desc limit 10
      ) x
    ), '[]'::jsonb),
    'interventions', coalesce((
      select jsonb_agg(x.obj order by x.created_at desc) from (
        select i.created_at,jsonb_build_object('kind',i.kind,'description',i.description,'status',i.status,'priority',i.priority,'suggestion_source',i.suggestion_source,'rationale',i.rationale,'teacher_approved',i.teacher_approved,'created_at',i.created_at) obj
        from public.interventions i where i.student_id=s.id order by i.created_at desc limit 10
      ) x
    ), '[]'::jsonb)
  ) into v_result
  from public.students s left join public.grades g on g.id=s.grade_id
  where s.id=p_student_id;

  if v_result is null then raise exception 'student not found'; end if;
  return v_result;
end;
$$;

revoke all on function public.build_ai_student_context(uuid) from public, anon;
grant execute on function public.build_ai_student_context(uuid) to authenticated;
