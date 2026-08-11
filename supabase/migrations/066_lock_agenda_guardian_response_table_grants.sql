-- CURIÓ · respostas de presença ficam somente leitura direta para usuários.
-- Toda escrita passa pela RPC respond_to_agenda_event, que valida papel, vínculo e evento.

revoke all privileges on table public.agenda_event_guardian_responses from anon, authenticated;
grant select on table public.agenda_event_guardian_responses to authenticated;

grant execute on function public.respond_to_agenda_event(uuid,uuid,text,text) to authenticated;
revoke execute on function public.respond_to_agenda_event(uuid,uuid,text,text) from anon, public;
