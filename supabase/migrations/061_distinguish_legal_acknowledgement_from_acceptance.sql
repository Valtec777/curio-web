-- CURIÓ · diferencia concordância/autorização de mera ciência de aviso de privacidade.

alter table public.legal_acceptance_events
  drop constraint if exists legal_acceptance_events_decision_check;

alter table public.legal_acceptance_events
  add constraint legal_acceptance_events_decision_check
  check (decision in ('accepted','acknowledged','declined','revoked'));

comment on column public.legal_acceptance_events.decision is
'accepted = agreement/authorization; acknowledged = notice read/acknowledged without treating the notice itself as blanket consent; declined/revoked apply to optional consent/authorization flows.';
