-- CURIÓ · Devolutiva humana opcional vinculada ao resultado da avaliação.

alter table public.assessment_students
  add column if not exists teacher_note text;

alter table public.assessment_students
  drop constraint if exists assessment_students_teacher_note_length_check;
alter table public.assessment_students
  add constraint assessment_students_teacher_note_length_check
  check (teacher_note is null or char_length(teacher_note) <= 2500);
