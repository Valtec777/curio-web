-- CURIÓ · IA especialista para Professor/Admin — estrutura e permissões
-- Esta migration prepara persistência e contexto pedagógico seguro.
-- Ela NÃO conecta um provedor/modelo de IA e NÃO executa ações automaticamente.

create table if not exists public.ai_assistant_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope_role text not null check (scope_role in ('teacher','admin')),
  student_id uuid references public.students(id) on delete set null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_assistant_threads(id) on delete cascade,
  sender text not null check (sender in ('user','assistant','system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  model_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_assistant_actions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_assistant_threads(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'suggested'
    check (status in ('suggested','accepted','rejected','executed')),
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_threads_user_idx
  on public.ai_assistant_threads(user_id, updated_at desc);
create index if not exists ai_threads_student_idx
  on public.ai_assistant_threads(student_id, updated_at desc)
  where student_id is not null;
create index if not exists ai_messages_thread_idx
  on public.ai_assistant_messages(thread_id, created_at);
create index if not exists ai_actions_thread_idx
  on public.ai_assistant_actions(thread_id, status, created_at desc);

alter table public.ai_assistant_threads enable row level security;
alter table public.ai_assistant_messages enable row level security;
alter table public.ai_assistant_actions enable row level security;

drop policy if exists ai_threads_select on public.ai_assistant_threads;
create policy ai_threads_select on public.ai_assistant_threads
for select to authenticated
using (private.has_role('admin'::app_role) or user_id = (select auth.uid()));

drop policy if exists ai_threads_insert on public.ai_assistant_threads;
create policy ai_threads_insert on public.ai_assistant_threads
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    (scope_role = 'admin' and private.has_role('admin'::app_role))
    or (
      scope_role = 'teacher'
      and private.has_role('teacher'::app_role)
      and (student_id is null or private.teacher_has_student(student_id))
    )
  )
);

drop policy if exists ai_threads_update on public.ai_assistant_threads;
create policy ai_threads_update on public.ai_assistant_threads
for update to authenticated
using (private.has_role('admin'::app_role) or user_id = (select auth.uid()))
with check (private.has_role('admin'::app_role) or user_id = (select auth.uid()));

drop policy if exists ai_messages_select on public.ai_assistant_messages;
create policy ai_messages_select on public.ai_assistant_messages
for select to authenticated
using (
  exists (
    select 1 from public.ai_assistant_threads t
    where t.id = thread_id
      and (private.has_role('admin'::app_role) or t.user_id = (select auth.uid()))
  )
);

drop policy if exists ai_messages_insert on public.ai_assistant_messages;
create policy ai_messages_insert on public.ai_assistant_messages
for insert to authenticated
with check (
  exists (
    select 1 from public.ai_assistant_threads t
    where t.id = thread_id
      and (private.has_role('admin'::app_role) or t.user_id = (select auth.uid()))
  )
);

drop policy if exists ai_actions_select on public.ai_assistant_actions;
create policy ai_actions_select on public.ai_assistant_actions
for select to authenticated
using (
  exists (
    select 1 from public.ai_assistant_threads t
    where t.id = thread_id
      and (private.has_role('admin'::app_role) or t.user_id = (select auth.uid()))
  )
);

drop policy if exists ai_actions_write on public.ai_assistant_actions;
create policy ai_actions_write on public.ai_assistant_actions
for all to authenticated
using (
  exists (
    select 1 from public.ai_assistant_threads t
    where t.id = thread_id
      and (private.has_role('admin'::app_role) or t.user_id = (select auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.ai_assistant_threads t
    where t.id = thread_id
      and (private.has_role('admin'::app_role) or t.user_id = (select auth.uid()))
  )
);

-- Contexto mínimo e permissionado para a futura IA.
-- Não inclui senha/PIN, mensagens privadas, contratos ou dados financeiros.
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

  if not v_allowed then
    raise exception 'not allowed';
  end if;

  select jsonb_build_object(
    'student', jsonb_build_object(
      'id', s.id,
      'preferred_name', s.preferred_name,
      'grade', g.name,
      'status', s.status
    ),
    'current_contents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject', sub.name,
        'content', c.name,
        'confirmed', sc.confirmed,
        'confidence', sc.confidence,
        'updated_at', sc.updated_at
      ) order by sc.updated_at desc)
      from public.student_current_contents sc
      left join public.subjects sub on sub.id = sc.subject_id
      left join public.contents c on c.id = sc.content_id
      where sc.student_id = s.id and sc.active = true
    ), '[]'::jsonb),
    'skill_states', coalesce((
      select jsonb_agg(jsonb_build_object(
        'skill', sk.name,
        'domain_level', st.domain_level,
        'autonomy_level', st.autonomy_level,
        'confidence', st.confidence,
        'trend', st.trend,
        'priority', st.priority,
        'diagnostic_label', st.diagnostic_label,
        'evidence_count', st.evidence_count,
        'updated_at', st.updated_at
      ) order by st.priority desc, st.updated_at desc)
      from public.student_skill_states st
      join public.skills sk on sk.id = st.skill_id
      where st.student_id = s.id
    ), '[]'::jsonb),
    'recent_evidence', coalesce((
      select jsonb_agg(x.obj order by x.observed_at desc)
      from (
        select e.observed_at,
          jsonb_build_object(
            'skill_id', e.skill_id,
            'result_code', e.result_code,
            'domain_level', e.domain_level,
            'autonomy_level', e.autonomy_level,
            'question_difficulty', e.question_difficulty,
            'evidence_weight', e.evidence_weight,
            'diagnostic_signal', e.diagnostic_signal,
            'teacher_confirmed', e.teacher_confirmed,
            'observed_at', e.observed_at
          ) as obj
        from public.pedagogical_evidence e
        where e.student_id = s.id
        order by e.observed_at desc
        limit 20
      ) x
    ), '[]'::jsonb),
    'recent_missions', coalesce((
      select jsonb_agg(x.obj order by x.assigned_at desc)
      from (
        select ms.assigned_at,
          jsonb_build_object(
            'mission_title', m.title,
            'status', ms.status,
            'progress_percent', ms.progress_percent,
            'due_at', ms.due_at,
            'completed_at', ms.completed_at,
            'before_score', ms.before_score,
            'after_score', ms.after_score
          ) as obj
        from public.mission_students ms
        join public.missions m on m.id = ms.mission_id
        where ms.student_id = s.id
        order by ms.assigned_at desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'interventions', coalesce((
      select jsonb_agg(x.obj order by x.created_at desc)
      from (
        select i.created_at,
          jsonb_build_object(
            'kind', i.kind,
            'description', i.description,
            'status', i.status,
            'priority', i.priority,
            'suggestion_source', i.suggestion_source,
            'rationale', i.rationale,
            'teacher_approved', i.teacher_approved,
            'created_at', i.created_at
          ) as obj
        from public.interventions i
        where i.student_id = s.id
        order by i.created_at desc
        limit 10
      ) x
    ), '[]'::jsonb)
  ) into v_result
  from public.students s
  left join public.grades g on g.id = s.grade_id
  where s.id = p_student_id;

  if v_result is null then
    raise exception 'student not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.build_ai_student_context(uuid) from public, anon;
grant execute on function public.build_ai_student_context(uuid) to authenticated;
