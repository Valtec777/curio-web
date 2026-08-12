-- CURIÓ · Avatar persistente por aluno
-- Guarda apenas a referência ao personagem; os assets já existem no projeto.

alter table public.student_game_profiles
  add column if not exists avatar_character_id uuid references public.characters(id) on delete set null;
