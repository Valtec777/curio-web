-- Basic database-level abuse protection for the public lead form.
-- app/actions.ts already treats unique violations as idempotent success.

create unique index if not exists enrollment_requests_email_day_unique
on public.enrollment_requests ((lower(email::text)), request_day)
where deleted_at is null;

create unique index if not exists enrollment_requests_phone_day_unique
on public.enrollment_requests ((regexp_replace(phone_whatsapp,'\D','','g')), request_day)
where deleted_at is null
  and regexp_replace(phone_whatsapp,'\D','','g') <> '';
