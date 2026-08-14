-- Curio · prontidao juridica e operacional
-- Documentos juridicos permanecem como rascunho ate revisao e publicacao manual.

begin;

alter table public.legal_documents add column if not exists audience text not null default 'public';
do $$ begin
  alter table public.legal_documents add constraint legal_documents_audience_check check (audience in ('public','family','contract','internal'));
exception when duplicate_object then null; end $$;
update public.legal_documents set audience='family' where public_slug in ('autorizacao-imagem-voz-producoes','consentimento-dados-pessoais');
update public.legal_documents set audience='contract' where public_slug='contrato-prestacao-servicos';
update public.legal_documents set audience='internal' where public_slug in ('modelo-recibo-pagamento','modelo-relatorio-acompanhamento');
update public.legal_documents set audience='public' where public_slug in ('cancelamento-faltas-reagendamentos','pagamento-cobranca','politica-de-privacidade','privacidade-da-crianca','termos-de-uso');

drop policy if exists legal_documents_public_select on public.legal_documents;
drop policy if exists legal_documents_anon_select on public.legal_documents;
drop policy if exists legal_documents_authenticated_select on public.legal_documents;
create policy legal_documents_anon_select on public.legal_documents for select to anon using (status='published' and is_current=true and audience='public');
create policy legal_documents_authenticated_select on public.legal_documents for select to authenticated using (private.has_role('admin'::app_role) or (status='published' and is_current=true and audience in ('public','family','contract')));

insert into public.app_settings(key,value,is_public) values (
  'legal_provider_profile',
  '{"brandName":"CURIÓ","legalName":"","taxId":"","address":"","email":"curio.educacao@gmail.com","phone":"","privacyContact":"curio.educacao@gmail.com"}'::jsonb,
  true
) on conflict (key) do nothing;

alter table public.contracts
  add column if not exists document_version integer,
  add column if not exists document_snapshot text,
  add column if not exists document_hash text,
  add column if not exists signed_name text,
  add column if not exists signature_method text,
  add column if not exists signature_evidence jsonb;
create unique index if not exists uq_contracts_subscription on public.contracts(subscription_id);

create or replace function private.ensure_contract_for_subscription()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp
as $$
begin
  insert into public.contracts(subscription_id,status) values(new.id,'sent') on conflict (subscription_id) do nothing;
  return new;
end $$;
drop trigger if exists trg_subscription_ensure_contract on public.subscriptions;
create trigger trg_subscription_ensure_contract after insert on public.subscriptions for each row execute function private.ensure_contract_for_subscription();
insert into public.contracts(subscription_id,status)
select s.id,'sent' from public.subscriptions s where not exists (select 1 from public.contracts c where c.subscription_id=s.id)
on conflict (subscription_id) do nothing;

create or replace function public.sign_guardian_contract(
  p_contract_id uuid,p_signed_name text,p_document_version integer,p_document_snapshot text,p_document_hash text,p_evidence jsonb default '{}'::jsonb
) returns boolean
language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_guardian_id uuid := private.guardian_id_for_user();
  v_contract public.contracts%rowtype;
begin
  if v_user is null or v_guardian_id is null then raise exception 'guardian authentication required'; end if;
  if nullif(trim(coalesce(p_signed_name,'')),'') is null then raise exception 'signed name required'; end if;
  if p_document_version is null or p_document_version < 1 then raise exception 'document version required'; end if;
  if nullif(trim(coalesce(p_document_snapshot,'')),'') is null then raise exception 'document snapshot required'; end if;
  if nullif(trim(coalesce(p_document_hash,'')),'') is null then raise exception 'document hash required'; end if;
  select c.* into v_contract from public.contracts c join public.subscriptions s on s.id=c.subscription_id
  where c.id=p_contract_id and s.guardian_id=v_guardian_id and c.status='sent' for update;
  if v_contract.id is null then raise exception 'contract unavailable'; end if;
  update public.contracts set
    status='signed',signed_by_user_id=v_user,signed_at=now(),signed_name=trim(p_signed_name),signature_method='authenticated_portal',
    document_version=p_document_version,document_snapshot=p_document_snapshot,document_hash=p_document_hash,
    signature_evidence=coalesce(p_evidence,'{}'::jsonb) || jsonb_build_object('user_id',v_user,'signed_at',now()),updated_at=now()
  where id=p_contract_id;
  return true;
end $$;
revoke all on function public.sign_guardian_contract(uuid,text,integer,text,text,jsonb) from public, anon;
grant execute on function public.sign_guardian_contract(uuid,text,integer,text,text,jsonb) to authenticated;

create or replace function public.guardian_contract_party_data(p_subscription_id uuid)
returns table(guardian_name text,guardian_cpf text,guardian_address text,guardian_relationship text,student_name text,student_birth_date date,student_grade text)
language sql stable security definer set search_path = public, private, pg_temp
as $$
  select gp.full_name,gpd.cpf,gpd.address,coalesce(gs.relationship,'responsável legal'),coalesce(st.full_name,st.preferred_name,'Aluno(a)'),spd.birth_date,gr.name
  from public.subscriptions sub
  join public.guardians g on g.id=sub.guardian_id
  join public.profiles gp on gp.id=g.profile_id
  join public.students st on st.id=sub.student_id
  left join public.guardian_students gs on gs.guardian_id=g.id and gs.student_id=st.id
  left join public.guardian_private_details gpd on gpd.guardian_id=g.id
  left join public.student_private_details spd on spd.student_id=st.id
  left join public.grades gr on gr.id=st.grade_id
  where sub.id=p_subscription_id and (g.id=private.guardian_id_for_user() or private.has_role('admin'::app_role))
  limit 1;
$$;
revoke all on function public.guardian_contract_party_data(uuid) from public, anon;
grant execute on function public.guardian_contract_party_data(uuid) to authenticated;

alter table public.plan_entitlements drop constraint if exists plan_entitlements_resource_key_check;
alter table public.plan_entitlements add constraint plan_entitlements_resource_key_check
  check (resource_key in ('meetings','family_meetings','missions','assessments','notebooks','materials','courses'));
alter table public.subscription_usage_events drop constraint if exists subscription_usage_events_resource_key_check;
alter table public.subscription_usage_events add constraint subscription_usage_events_resource_key_check
  check (resource_key in ('meetings','family_meetings','missions','assessments','notebooks','materials','courses'));

create or replace function private.consume_agenda_student()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare v_event public.agenda_events%rowtype; v_resource text;
begin
  select * into v_event from public.agenda_events where id=new.event_id;
  if v_event.id is not null and v_event.status <> 'cancelled' then
    if v_event.event_type in ('class','review') then v_resource := 'meetings';
    elsif v_event.event_type in ('family_meeting','meeting') then v_resource := 'family_meetings'; end if;
    if v_resource is not null then perform private.record_plan_usage(new.student_id,v_resource,'agenda_event',new.event_id,v_event.starts_at,1); end if;
  end if;
  return new;
end $$;

create or replace function private.reverse_cancelled_agenda_usage()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare v_student uuid; v_resource text;
begin
  if new.status='cancelled' and old.status is distinct from 'cancelled' then perform private.reverse_plan_usage(null,'agenda_event',new.id,'agenda_cancelled'); end if;
  if old.status='cancelled' and new.status<>'cancelled' then
    if new.event_type in ('class','review') then v_resource := 'meetings';
    elsif new.event_type in ('family_meeting','meeting') then v_resource := 'family_meetings'; end if;
    if v_resource is not null then
      for v_student in select a.student_id from public.agenda_event_students a where a.event_id=new.id loop
        perform private.record_plan_usage(v_student,v_resource,'agenda_event',new.id,new.starts_at,1);
      end loop;
    end if;
  end if;
  return new;
end $$;

create or replace function public.create_teacher_agenda_series(
  p_idempotency_key text,p_student_id uuid,p_title text,p_description text,p_event_type text,p_starts_at timestamptz,
  p_ends_at timestamptz default null,p_meeting_url text default null,p_location text default null,p_visible_to_student boolean default true,
  p_visible_to_guardian boolean default true,p_repeat_weeks integer default 4
) returns uuid[]
language plpgsql set search_path = public, private, pg_temp
as $$
declare v_ids uuid[] := '{}'::uuid[]; v_id uuid; v_i integer; v_key text;
begin
  if p_event_type not in ('class','review') then raise exception 'weekly series only supports class or review'; end if;
  if p_repeat_weeks < 2 or p_repeat_weeks > 24 then raise exception 'repeat weeks must be between 2 and 24'; end if;
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then raise exception 'idempotency key required'; end if;
  for v_i in 0..(p_repeat_weeks-1) loop
    v_key := left(p_idempotency_key,140) || ':w' || lpad((v_i+1)::text,2,'0');
    v_id := public.create_teacher_agenda_event(
      v_key,p_student_id,p_title,p_description,p_event_type,p_starts_at + make_interval(days => v_i*7),
      case when p_ends_at is null then null else p_ends_at + make_interval(days => v_i*7) end,
      p_meeting_url,p_location,p_visible_to_student,p_visible_to_guardian
    );
    v_ids := array_append(v_ids,v_id);
  end loop;
  return v_ids;
end $$;
revoke all on function public.create_teacher_agenda_series(text,uuid,text,text,text,timestamptz,timestamptz,text,text,boolean,boolean,integer) from public, anon;
grant execute on function public.create_teacher_agenda_series(text,uuid,text,text,text,timestamptz,timestamptz,text,text,boolean,boolean,integer) to authenticated;

update public.plans set monthly_price=180,meetings_per_month=5,badge='Piloto',active=true,visible_on_landing=true,available_for_enrollment=true,
  description='Entrada de validação: acompanhamento semanal com rotina digital e reunião mensal com a família.',
  features='["4 aulas com o aluno + 1 encontro com responsável (5 encontros totais)","4 Missões Cuca por mês","2 atividades de Caderno por mês","1 avaliação de acompanhamento por mês","4 materiais de apoio por mês","1 curso do Modo Pensar por mês"]'::jsonb,updated_at=now()
where lower(name)=lower('Plano Piloto CURIÓ') and deleted_at is null;
update public.plans set monthly_price=249,meetings_per_month=5,badge=null,active=true,visible_on_landing=true,available_for_enrollment=true,
  description='Acompanhamento essencial para quem precisa de constância semanal, prática e visão clara da evolução.',
  features='["4 aulas com o aluno + 1 encontro com responsável (5 encontros totais)","8 Missões Cuca por mês","4 atividades de Caderno por mês","1 avaliação de acompanhamento por mês","8 materiais de apoio por mês","2 cursos do Modo Pensar por mês"]'::jsonb,updated_at=now()
where lower(name)=lower('CURIÓ Essencial') and deleted_at is null;
update public.plans set monthly_price=399,meetings_per_month=9,badge='Recomendado',active=true,visible_on_landing=true,available_for_enrollment=true,
  description='Acompanhamento mais próximo, com duas aulas por semana e maior volume de prática e devolutivas.',
  features='["8 aulas com o aluno + 1 encontro com responsável (9 encontros totais)","16 Missões Cuca por mês","8 atividades de Caderno por mês","2 avaliações de acompanhamento por mês","16 materiais de apoio por mês","4 cursos do Modo Pensar por mês"]'::jsonb,updated_at=now()
where lower(name)=lower('CURIÓ Acompanhamento') and deleted_at is null;
update public.plans set monthly_price=549,meetings_per_month=9,badge='Intensivo',active=true,visible_on_landing=true,available_for_enrollment=true,
  description='Acompanhamento intensivo com educador, alto volume de prática, avaliações frequentes e acesso amplo ao Modo Pensar.',
  features='["8 aulas com o aluno + 1 encontro com responsável (9 encontros totais)","24 Missões Cuca por mês","12 atividades de Caderno por mês","3 avaliações de acompanhamento por mês","24 materiais de apoio por mês","Acesso aos cursos publicados do Modo Pensar"]'::jsonb,updated_at=now()
where lower(name)=lower('CURIÓ com Educador') and deleted_at is null;

with cfg(plan_name,resource_key,lim) as (values
('Plano Piloto CURIÓ','meetings',4),('Plano Piloto CURIÓ','family_meetings',1),('Plano Piloto CURIÓ','missions',4),('Plano Piloto CURIÓ','notebooks',2),('Plano Piloto CURIÓ','assessments',1),('Plano Piloto CURIÓ','materials',4),('Plano Piloto CURIÓ','courses',1),
('CURIÓ Essencial','meetings',4),('CURIÓ Essencial','family_meetings',1),('CURIÓ Essencial','missions',8),('CURIÓ Essencial','notebooks',4),('CURIÓ Essencial','assessments',1),('CURIÓ Essencial','materials',8),('CURIÓ Essencial','courses',2),
('CURIÓ Acompanhamento','meetings',8),('CURIÓ Acompanhamento','family_meetings',1),('CURIÓ Acompanhamento','missions',16),('CURIÓ Acompanhamento','notebooks',8),('CURIÓ Acompanhamento','assessments',2),('CURIÓ Acompanhamento','materials',16),('CURIÓ Acompanhamento','courses',4),
('CURIÓ com Educador','meetings',8),('CURIÓ com Educador','family_meetings',1),('CURIÓ com Educador','missions',24),('CURIÓ com Educador','notebooks',12),('CURIÓ com Educador','assessments',3),('CURIÓ com Educador','materials',24))
insert into public.plan_entitlements(plan_id,resource_key,limit_per_cycle,enabled,hard_limit,warning_percent)
select p.id,c.resource_key,c.lim,true,true,80 from cfg c join public.plans p on lower(p.name)=lower(c.plan_name) and p.deleted_at is null
on conflict (plan_id,resource_key) do update set limit_per_cycle=excluded.limit_per_cycle,enabled=true,hard_limit=true,warning_percent=80,updated_at=now();
insert into public.plan_entitlements(plan_id,resource_key,limit_per_cycle,enabled,hard_limit,warning_percent)
select p.id,'courses',null,true,false,80 from public.plans p where lower(p.name)=lower('CURIÓ com Educador') and p.deleted_at is null
on conflict (plan_id,resource_key) do update set limit_per_cycle=null,enabled=true,hard_limit=false,warning_percent=80,updated_at=now();

commit;
