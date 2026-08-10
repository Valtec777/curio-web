-- CURIÓ · timestamp para ordenar avaliações atribuídas de forma consistente no portal.
alter table public.assessment_students
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_assessment_students_student_created
  on public.assessment_students(student_id, created_at desc);
