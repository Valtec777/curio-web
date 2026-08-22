-- Fase 8: reduz privilégios diretos da tabela de leads ao mínimo necessário.
-- A autorização por linha continua sendo controlada pelas policies RLS existentes.

revoke references, trigger, truncate
  on table public.enrollment_requests
  from anon, authenticated;

revoke delete
  on table public.enrollment_requests
  from authenticated;
