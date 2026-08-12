-- CURIÓ · impede atribuições duplicadas do mesmo material para o mesmo aluno.
-- UNIQUE aceita múltiplos NULLs, então atribuições por turma/grupo continuam independentes.

alter table public.material_assignments
  add constraint material_assignments_material_student_key unique (material_id, student_id);
