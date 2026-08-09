-- CURIÓ · Missão Cuca como quiz interativo sem expor gabarito ao aluno
alter table public.mission_questions
  add column if not exists options jsonb not null default '[]'::jsonb;

create table if not exists public.mission_question_answer_keys (
  question_id uuid primary key references public.mission_questions(id) on delete cascade,
  correct_value text not null,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mission_question_answer_keys enable row level security;

drop policy if exists mission_answer_keys_select on public.mission_question_answer_keys;
create policy mission_answer_keys_select on public.mission_question_answer_keys for select to authenticated
using (
  private.has_role('admin'::app_role)
  or exists (
    select 1
    from public.mission_questions q
    join public.missions m on m.id=q.mission_id
    where q.id=question_id and m.created_by_teacher_id=private.teacher_id_for_user()
  )
);

drop policy if exists mission_answer_keys_write on public.mission_question_answer_keys;
create policy mission_answer_keys_write on public.mission_question_answer_keys for all to authenticated
using (
  private.has_role('admin'::app_role)
  or exists (
    select 1
    from public.mission_questions q
    join public.missions m on m.id=q.mission_id
    where q.id=question_id and m.created_by_teacher_id=private.teacher_id_for_user()
  )
)
with check (
  private.has_role('admin'::app_role)
  or exists (
    select 1
    from public.mission_questions q
    join public.missions m on m.id=q.mission_id
    where q.id=question_id and m.created_by_teacher_id=private.teacher_id_for_user()
  )
);

create index if not exists mission_questions_type_idx on public.mission_questions(mission_id, question_type, position);
