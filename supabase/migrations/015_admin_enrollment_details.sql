-- CURIÓ · detalhes de matrícula, dados privados e disponibilidade docente
-- Estrutura aditiva e compatível com o fluxo existente de convites.

create table if not exists public.student_private_details (
  student_id uuid primary key references public.students(id) on delete cascade,
  birth_date date,
  cpf text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_learning_profiles (
  student_id uuid primary key references public.students(id) on delete cascade,
  tracked_subjects text[] not null default '{}',
  pedagogical_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guardian_private_details (
  guardian_id uuid primary key references public.guardians(id) on delete cascade,
  cpf text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher_availability (
  teacher_id uuid primary key references public.teachers(id) on delete cascade,
  available_periods text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_private_details enable row level security;
alter table public.student_learning_profiles enable row level security;
alter table public.guardian_private_details enable row level security;
alter table public.teacher_availability enable row level security;

drop policy if exists student_private_admin_all on public.student_private_details;
create policy student_private_admin_all on public.student_private_details
for all to authenticated
using (private.has_role('admin'::app_role))
with check (private.has_role('admin'::app_role));

drop policy if exists student_learning_admin_all on public.student_learning_profiles;
create policy student_learning_admin_all on public.student_learning_profiles
for all to authenticated
using (private.has_role('admin'::app_role))
with check (private.has_role('admin'::app_role));

drop policy if exists student_learning_teacher_select on public.student_learning_profiles;
create policy student_learning_teacher_select on public.student_learning_profiles
for select to authenticated
using (
  private.has_role('teacher'::app_role)
  and private.teacher_has_student(student_id)
);

drop policy if exists guardian_private_admin_all on public.guardian_private_details;
create policy guardian_private_admin_all on public.guardian_private_details
for all to authenticated
using (private.has_role('admin'::app_role))
with check (private.has_role('admin'::app_role));

drop policy if exists teacher_availability_admin_all on public.teacher_availability;
create policy teacher_availability_admin_all on public.teacher_availability
for all to authenticated
using (private.has_role('admin'::app_role))
with check (private.has_role('admin'::app_role));

drop policy if exists teacher_availability_teacher_select on public.teacher_availability;
create policy teacher_availability_teacher_select on public.teacher_availability
for select to authenticated
using (
  private.has_role('teacher'::app_role)
  and teacher_id = private.teacher_id_for_user()
);

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'touch_updated_at'
  ) then
    if not exists (select 1 from pg_trigger where tgname='touch_student_private_details_updated_at') then
      create trigger touch_student_private_details_updated_at
      before update on public.student_private_details
      for each row execute function public.touch_updated_at();
    end if;
    if not exists (select 1 from pg_trigger where tgname='touch_student_learning_profiles_updated_at') then
      create trigger touch_student_learning_profiles_updated_at
      before update on public.student_learning_profiles
      for each row execute function public.touch_updated_at();
    end if;
    if not exists (select 1 from pg_trigger where tgname='touch_guardian_private_details_updated_at') then
      create trigger touch_guardian_private_details_updated_at
      before update on public.guardian_private_details
      for each row execute function public.touch_updated_at();
    end if;
    if not exists (select 1 from pg_trigger where tgname='touch_teacher_availability_updated_at') then
      create trigger touch_teacher_availability_updated_at
      before update on public.teacher_availability
      for each row execute function public.touch_updated_at();
    end if;
  end if;
end $$;
