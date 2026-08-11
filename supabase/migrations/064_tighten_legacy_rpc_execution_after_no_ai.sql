-- CURIÓ · reduz superfície RPC e aplica a decisão atual de não expor IA.

-- Funções de operação já validam papel/vínculo internamente, mas o papel anon
-- não precisa sequer poder chamá-las.
revoke execute on function public.create_teacher_agenda_event(text,uuid,text,text,text,timestamptz,timestamptz,text,text,boolean,boolean) from anon;
revoke execute on function public.create_teacher_mission(text,text,text,integer,uuid,uuid,text,text,text,jsonb,text) from anon;
revoke execute on function public.finalize_guardian_enrollment(uuid,uuid,uuid) from anon;
revoke execute on function public.update_admin_enrollment_details(uuid,text,text,uuid,text,text,text,text,text) from anon;

-- A estrutura histórica de contexto de IA é preservada no banco para não apagar
-- migrations/dados antigos, mas deixa de ser executável pela aplicação.
revoke execute on function public.build_ai_student_context(uuid) from public, anon, authenticated;
