-- CURIÓ · Idempotência da fila de geração

alter table public.generation_jobs
  add column if not exists idempotency_key text,
  add column if not exists request_day date not null default ((now() at time zone 'America/Bahia')::date);

create unique index if not exists generation_jobs_user_idempotency_day_uidx
  on public.generation_jobs(requested_by_user_id,idempotency_key,request_day)
  where idempotency_key is not null;
