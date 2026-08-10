-- CURIÓ · Segurança do aceite de convite
-- O RPC é chamado somente após o usuário autenticado definir a própria senha.

revoke all on function public.mark_access_invitation_accepted() from public;
revoke execute on function public.mark_access_invitation_accepted() from anon;
grant execute on function public.mark_access_invitation_accepted() to authenticated;
