-- CURIÓ · validação pública mínima de certificados de cursos livres.
-- O código funciona como chave de consulta; a resposta não expõe IDs internos nem nome civil completo.

create or replace function public.verify_free_course_certificate(p_code text)
returns table(
  valid boolean,
  certificate_code text,
  holder_name text,
  course_title text,
  estimated_minutes integer,
  issued_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if v_code !~ '^CURIO-[A-F0-9]{12}$' then
    return query select false, null::text, null::text, null::text, null::integer, null::timestamptz;
    return;
  end if;

  return query
  select
    true,
    cert.certificate_code,
    coalesce(nullif(s.preferred_name, ''), split_part(s.full_name, ' ', 1)),
    c.title,
    c.estimated_minutes,
    cert.issued_at
  from public.free_course_certificates cert
  join public.free_courses c on c.id = cert.course_id
  join public.students s on s.id = cert.student_id
  where cert.certificate_code = v_code
  limit 1;

  if not found then
    return query select false, null::text, null::text, null::text, null::integer, null::timestamptz;
  end if;
end;
$$;

revoke all on function public.verify_free_course_certificate(text) from public;
grant execute on function public.verify_free_course_certificate(text) to anon, authenticated;

comment on function public.verify_free_course_certificate(text) is
'Validates an exact Curio free-course certificate code and returns only minimal public verification data.';
