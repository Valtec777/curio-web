-- CURIÓ · Permissão do helper de participação em conversas
-- As policies de mensagens chamam este helper para validar auth.uid().

revoke all on function private.is_thread_participant(uuid) from public;
grant execute on function private.is_thread_participant(uuid) to authenticated;
