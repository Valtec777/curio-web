-- CURIÓ · amplia a taxonomia acadêmica existente até o 3º ano do Ensino Médio.
-- Mantém os IDs/nomes atuais do Fundamental e apenas acrescenta as novas séries.

insert into public.grades(name, sort_order, active)
values
  ('1º ano do Ensino Médio', 10, true),
  ('2º ano do Ensino Médio', 11, true),
  ('3º ano do Ensino Médio', 12, true)
on conflict (name) do update
set sort_order = excluded.sort_order,
    active = true;

insert into public.subjects(name, active)
values
  ('Biologia', true),
  ('Física', true),
  ('Química', true),
  ('Sociologia', true),
  ('Filosofia', true)
on conflict (name) do update
set active = true;
