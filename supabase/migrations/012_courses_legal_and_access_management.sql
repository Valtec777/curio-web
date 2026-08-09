-- CURIÓ · Cursos Livres, certificados, documentos legais e apoio à gestão de acessos

alter table public.guardians
  add column if not exists active boolean not null default true;

create table if not exists public.free_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  description text,
  cover_image_path text,
  audience_label text default 'Crianças e adolescentes',
  estimated_minutes integer not null default 60 check (estimated_minutes between 1 and 100000),
  certificate_enabled boolean not null default true,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by_user_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.free_course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.free_courses(id) on delete cascade,
  title text not null,
  description text,
  body text,
  resource_type text not null default 'lesson' check (resource_type in ('lesson','video','link','download','practice')),
  external_url text,
  file_path text,
  position integer not null default 1 check (position > 0),
  duration_minutes integer not null default 10 check (duration_minutes between 1 and 10000),
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, position)
);

create table if not exists public.free_course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.free_courses(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, student_id)
);

create table if not exists public.free_course_module_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.free_course_enrollments(id) on delete cascade,
  module_id uuid not null references public.free_course_modules(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique(enrollment_id, module_id)
);

create table if not exists public.free_course_certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.free_course_enrollments(id) on delete cascade,
  course_id uuid not null references public.free_courses(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  certificate_code text not null unique,
  issued_at timestamptz not null default now(),
  file_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  public_slug text not null,
  document_type text not null default 'Legal',
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  is_current boolean not null default true,
  body text,
  file_path text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(public_slug, version)
);

create unique index if not exists legal_documents_one_current_per_slug
  on public.legal_documents(public_slug) where is_current;
create index if not exists free_course_modules_course_position_idx on public.free_course_modules(course_id, position);
create index if not exists free_course_enrollments_student_idx on public.free_course_enrollments(student_id, updated_at desc);
create index if not exists free_course_progress_student_idx on public.free_course_module_progress(student_id, completed_at desc);
create index if not exists free_course_certificates_student_idx on public.free_course_certificates(student_id, issued_at desc);
create index if not exists legal_documents_public_idx on public.legal_documents(status, is_current, public_slug);

alter table public.free_courses enable row level security;
alter table public.free_course_modules enable row level security;
alter table public.free_course_enrollments enable row level security;
alter table public.free_course_module_progress enable row level security;
alter table public.free_course_certificates enable row level security;
alter table public.legal_documents enable row level security;

drop policy if exists free_courses_select on public.free_courses;
create policy free_courses_select on public.free_courses for select to authenticated
using (status = 'published' or private.has_role('admin'::app_role) or private.has_role('teacher'::app_role));
drop policy if exists free_courses_admin_write on public.free_courses;
create policy free_courses_admin_write on public.free_courses for all to authenticated
using (private.has_role('admin'::app_role)) with check (private.has_role('admin'::app_role));

drop policy if exists free_course_modules_select on public.free_course_modules;
create policy free_course_modules_select on public.free_course_modules for select to authenticated
using (exists (select 1 from public.free_courses c where c.id=course_id and (c.status='published' or private.has_role('admin'::app_role) or private.has_role('teacher'::app_role))));
drop policy if exists free_course_modules_admin_write on public.free_course_modules;
create policy free_course_modules_admin_write on public.free_course_modules for all to authenticated
using (private.has_role('admin'::app_role)) with check (private.has_role('admin'::app_role));

drop policy if exists free_course_enrollments_select on public.free_course_enrollments;
create policy free_course_enrollments_select on public.free_course_enrollments for select to authenticated
using (
  private.has_role('admin'::app_role)
  or private.teacher_has_student(student_id)
  or private.guardian_has_student(student_id)
  or student_id in (select s.id from public.students s where s.auth_user_id=(select auth.uid()))
);
drop policy if exists free_course_enrollments_admin_write on public.free_course_enrollments;
create policy free_course_enrollments_admin_write on public.free_course_enrollments for all to authenticated
using (private.has_role('admin'::app_role)) with check (private.has_role('admin'::app_role));

drop policy if exists free_course_progress_select on public.free_course_module_progress;
create policy free_course_progress_select on public.free_course_module_progress for select to authenticated
using (
  private.has_role('admin'::app_role)
  or private.teacher_has_student(student_id)
  or private.guardian_has_student(student_id)
  or student_id in (select s.id from public.students s where s.auth_user_id=(select auth.uid()))
);
drop policy if exists free_course_progress_admin_write on public.free_course_module_progress;
create policy free_course_progress_admin_write on public.free_course_module_progress for all to authenticated
using (private.has_role('admin'::app_role)) with check (private.has_role('admin'::app_role));

drop policy if exists free_course_certificates_select on public.free_course_certificates;
create policy free_course_certificates_select on public.free_course_certificates for select to authenticated
using (
  private.has_role('admin'::app_role)
  or private.teacher_has_student(student_id)
  or private.guardian_has_student(student_id)
  or student_id in (select s.id from public.students s where s.auth_user_id=(select auth.uid()))
);
drop policy if exists free_course_certificates_admin_write on public.free_course_certificates;
create policy free_course_certificates_admin_write on public.free_course_certificates for all to authenticated
using (private.has_role('admin'::app_role)) with check (private.has_role('admin'::app_role));

drop policy if exists legal_documents_public_select on public.legal_documents;
create policy legal_documents_public_select on public.legal_documents for select to anon, authenticated
using ((status='published' and is_current=true) or private.has_role('admin'::app_role));
drop policy if exists legal_documents_admin_write on public.legal_documents;
create policy legal_documents_admin_write on public.legal_documents for all to authenticated
using (private.has_role('admin'::app_role)) with check (private.has_role('admin'::app_role));

create or replace function private.can_use_student_context(p_student_id uuid)
returns boolean language sql stable security definer set search_path=public,private as $$
  select private.has_role('admin'::app_role)
    or private.guardian_has_student(p_student_id)
    or exists(select 1 from public.students s where s.id=p_student_id and s.auth_user_id=(select auth.uid()));
$$;
revoke all on function private.can_use_student_context(uuid) from public;
grant execute on function private.can_use_student_context(uuid) to authenticated;

create or replace function public.start_free_course(p_course_id uuid, p_student_id uuid)
returns uuid language plpgsql security definer set search_path=public,private as $$
declare v_id uuid;
begin
  if not private.can_use_student_context(p_student_id) then raise exception 'not allowed'; end if;
  if not exists(select 1 from public.free_courses where id=p_course_id and status='published') then raise exception 'course unavailable'; end if;
  insert into public.free_course_enrollments(course_id,student_id,status,progress_percent)
  values(p_course_id,p_student_id,'in_progress',0)
  on conflict(course_id,student_id) do update set updated_at=now()
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.start_free_course(uuid,uuid) from public,anon;
grant execute on function public.start_free_course(uuid,uuid) to authenticated;

create or replace function public.complete_free_course_module(p_module_id uuid, p_student_id uuid)
returns table(progress_percent smallint, course_completed boolean, certificate_code text)
language plpgsql security definer set search_path=public,private as $$
declare
  v_course_id uuid; v_enrollment_id uuid; v_required int; v_done int; v_progress smallint; v_completed boolean; v_code text;
begin
  if not private.can_use_student_context(p_student_id) then raise exception 'not allowed'; end if;
  select m.course_id into v_course_id from public.free_course_modules m join public.free_courses c on c.id=m.course_id where m.id=p_module_id and c.status='published';
  if v_course_id is null then raise exception 'module unavailable'; end if;
  select public.start_free_course(v_course_id,p_student_id) into v_enrollment_id;
  insert into public.free_course_module_progress(enrollment_id,module_id,student_id)
  values(v_enrollment_id,p_module_id,p_student_id) on conflict(enrollment_id,module_id) do nothing;
  select count(*) into v_required from public.free_course_modules where course_id=v_course_id and required=true;
  select count(*) into v_done from public.free_course_module_progress p join public.free_course_modules m on m.id=p.module_id where p.enrollment_id=v_enrollment_id and m.required=true;
  v_progress := case when v_required=0 then 100 else least(100,round(v_done*100.0/v_required)::int)::smallint end;
  v_completed := v_progress=100;
  update public.free_course_enrollments set progress_percent=v_progress,status=case when v_completed then 'completed' else 'in_progress' end,completed_at=case when v_completed then coalesce(completed_at,now()) else null end,updated_at=now() where id=v_enrollment_id;
  if v_completed and exists(select 1 from public.free_courses where id=v_course_id and certificate_enabled=true) then
    insert into public.free_course_certificates(enrollment_id,course_id,student_id,certificate_code)
    values(v_enrollment_id,v_course_id,p_student_id,'CURIO-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)))
    on conflict(enrollment_id) do nothing;
    select c.certificate_code into v_code from public.free_course_certificates c where c.enrollment_id=v_enrollment_id;
  end if;
  return query select v_progress,v_completed,v_code;
end; $$;
revoke all on function public.complete_free_course_module(uuid,uuid) from public,anon;
grant execute on function public.complete_free_course_module(uuid,uuid) to authenticated;

-- Catálogo jurídico informado pela administração. Conteúdo/arquivo pode ser preenchido e versionado no painel.
insert into public.legal_documents(title,public_slug,document_type,version,status,is_current,published_at)
values
('Modelo de Recibo de Pagamento — CURIÓ','modelo-recibo-pagamento','Modelo de Recibo',1,'draft',true,null),
('Modelo de Relatório de Acompanhamento Pedagógico — CURIÓ','modelo-relatorio-acompanhamento','Modelo de Relatório',1,'draft',true,null),
('Política de Cancelamento, Faltas e Reagendamentos — CURIÓ','cancelamento-faltas-reagendamentos','Termos de Uso',1,'draft',true,null),
('Política de Pagamento e Cobrança — CURIÓ','pagamento-cobranca','Política de Pagamento',1,'draft',true,null),
('Termo de Consentimento Específico para Tratamento de Dados Pessoais — CURIÓ','consentimento-dados-pessoais','Consentimento',1,'draft',true,null),
('Autorização para Uso de Imagem, Voz e Produções — CURIÓ','autorizacao-imagem-voz-producoes','Autorização de Imagem',1,'published',true,now()),
('PRIVACIDADE DA CRIANÇA — CURIÓ','privacidade-da-crianca','Privacidade da Criança',1,'published',true,now()),
('Contrato de Prestação de Serviços de Acompanhamento Escolar — CURIÓ','contrato-prestacao-servicos','Contrato',1,'published',true,now()),
('Termos de Uso do CURIÓ','termos-de-uso','Termos de Uso',1,'published',true,now())
on conflict(public_slug,version) do nothing;
