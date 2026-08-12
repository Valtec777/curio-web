-- CURIÓ · Permissão necessária para a policy de agenda avaliar turmas do professor.
-- Sem este grant, a leitura de agenda pelo papel authenticated falha antes da policy concluir.

grant execute on function private.teacher_has_class(uuid) to authenticated;
