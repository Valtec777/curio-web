-- PLUMARELI · apoio de leitura e Modo Acompanhado
-- Preferências pedagógicas simples, por aluno, visíveis à família, ao aluno e à equipe vinculada.

create table if not exists public.student_support_preferences (
  student_id uuid primary key references public.students(id) on delete cascade,
  reading_autonomy text not null default 'independent'
    check (reading_autonomy in ('independent', 'developing', 'needs_support')),
  guided_mode boolean not null default false,
  audio_instructions boolean not null default false,
  updated_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_support_preferences enable row level security;

revoke all on table public.student_support_preferences from anon;
grant select, insert, update on table public.student_support_preferences to authenticated;

drop policy if exists student_support_preferences_select on public.student_support_preferences;
create policy student_support_preferences_select
on public.student_support_preferences
for select to authenticated
using (
  private.has_role('admin'::app_role)
  or private.teacher_has_student(student_id)
  or private.guardian_has_student(student_id)
  or exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.auth_user_id = (select auth.uid())
      and s.deleted_at is null
  )
);

drop policy if exists student_support_preferences_insert on public.student_support_preferences;
create policy student_support_preferences_insert
on public.student_support_preferences
for insert to authenticated
with check (
  private.has_role('admin'::app_role)
  or private.guardian_has_student(student_id)
  or exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.auth_user_id = (select auth.uid())
      and s.deleted_at is null
  )
);

drop policy if exists student_support_preferences_update on public.student_support_preferences;
create policy student_support_preferences_update
on public.student_support_preferences
for update to authenticated
using (
  private.has_role('admin'::app_role)
  or private.guardian_has_student(student_id)
  or exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.auth_user_id = (select auth.uid())
      and s.deleted_at is null
  )
)
with check (
  private.has_role('admin'::app_role)
  or private.guardian_has_student(student_id)
  or exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.auth_user_id = (select auth.uid())
      and s.deleted_at is null
  )
);

comment on table public.student_support_preferences is
  'Preferências de apoio à leitura, Modo Acompanhado e instruções em áudio por aluno.';
comment on column public.student_support_preferences.reading_autonomy is
  'independent: lê com autonomia; developing: em processo; needs_support: precisa de apoio para leitura.';
comment on column public.student_support_preferences.guided_mode is
  'Permite orientar que um responsável apoie navegação/leitura sem fazer a atividade pelo aluno.';
comment on column public.student_support_preferences.audio_instructions is
  'Exibe leitura em voz alta das instruções no portal do aluno.';
