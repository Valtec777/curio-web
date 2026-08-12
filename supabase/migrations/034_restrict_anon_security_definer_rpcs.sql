-- CURIÓ · Segurança: RPCs privilegiadas não devem ficar executáveis pelo papel anon.
-- Mantém uso autenticado já validado pelo corpo das funções e fecha exposição desnecessária via REST RPC.

revoke all on function public.set_student_avatar(uuid, uuid) from public;
revoke execute on function public.set_student_avatar(uuid, uuid) from anon;
grant execute on function public.set_student_avatar(uuid, uuid) to authenticated;

revoke all on function public.teacher_linked_guardian_names() from public;
revoke execute on function public.teacher_linked_guardian_names() from anon;
grant execute on function public.teacher_linked_guardian_names() to authenticated;
