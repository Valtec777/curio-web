-- CURIÓ · Planos comerciais e gestão editorial
-- Aplicado no projeto em 2026-08-09. Não contém dados de conta pessoal.

alter table public.plans add column if not exists billing_interval text not null default 'monthly';
alter table public.plans add column if not exists meetings_per_month integer not null default 0;
alter table public.plans add column if not exists delivery_mode text not null default 'online';
alter table public.plans add column if not exists visible_on_landing boolean not null default false;
alter table public.plans add column if not exists available_for_enrollment boolean not null default true;
alter table public.plans add column if not exists badge text;
alter table public.plans add column if not exists sort_order integer not null default 0;
alter table public.plans add column if not exists archived_at timestamptz;
alter table public.plans add column if not exists deleted_at timestamptz;
alter table public.plans add column if not exists deleted_by_user_id uuid;

create index if not exists idx_plans_visible_active
  on public.plans(sort_order)
  where active and visible_on_landing and archived_at is null and deleted_at is null;

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
for update to authenticated
using (
  private.has_role('admin'::app_role)
  or (sender_user_id = (select auth.uid()) and private.has_role('teacher'::app_role))
)
with check (
  private.has_role('admin'::app_role)
  or (sender_user_id = (select auth.uid()) and private.has_role('teacher'::app_role))
);

-- Planos de referência. Em ambientes já povoados, revisar duplicidades antes de executar os INSERTs.
update public.plans
set name='Plano Piloto CURIÓ',
    description='Uma primeira experiência de acompanhamento escolar personalizado.',
    monthly_price=180,
    billing_interval='monthly', meetings_per_month=4, delivery_mode='online',
    visible_on_landing=false, available_for_enrollment=true, badge='Piloto', sort_order=20,
    active=true, archived_at=null, deleted_at=null,
    features='["4 encontros por mês","Online","Acompanhamento personalizado"]'::jsonb,
    updated_at=now()
where name in ('Plano Curió — Piloto','Plano Piloto CURIÓ');

insert into public.plans(name,description,monthly_price,currency,features,active,billing_interval,meetings_per_month,delivery_mode,visible_on_landing,available_for_enrollment,badge,sort_order)
select 'CURIÓ Essencial','Acompanhamento semanal para organizar e fortalecer a aprendizagem.',249,'BRL','["4 encontros por mês","Online"]'::jsonb,true,'monthly',4,'online',true,true,null,10
where not exists (select 1 from public.plans where name='CURIÓ Essencial' and deleted_at is null);

insert into public.plans(name,description,monthly_price,currency,features,active,billing_interval,meetings_per_month,delivery_mode,visible_on_landing,available_for_enrollment,badge,sort_order)
select 'CURIÓ Acompanhamento — Lançamento','Acompanhamento mais próximo por um valor especial de lançamento.',349,'BRL','["8 encontros por mês","Online"]'::jsonb,true,'monthly',8,'online',true,true,'Recomendado',30
where not exists (select 1 from public.plans where name='CURIÓ Acompanhamento — Lançamento' and deleted_at is null);

insert into public.plans(name,description,monthly_price,currency,features,active,billing_interval,meetings_per_month,delivery_mode,visible_on_landing,available_for_enrollment,badge,sort_order)
select 'CURIÓ Acompanhamento','Acompanhamento completo para uma rotina escolar mais organizada.',399,'BRL','["8 encontros por mês","Online"]'::jsonb,true,'monthly',8,'online',true,true,'Recomendado',40
where not exists (select 1 from public.plans where name='CURIÓ Acompanhamento' and deleted_at is null);

insert into public.plans(name,description,monthly_price,currency,features,active,billing_interval,meetings_per_month,delivery_mode,visible_on_landing,available_for_enrollment,badge,sort_order)
select 'CURIÓ com Educador','Professor parceiro com toda a estrutura e acompanhamento do CURIÓ.',549,'BRL','["8 encontros por mês","Online"]'::jsonb,false,'monthly',8,'online',false,false,null,50
where not exists (select 1 from public.plans where name='CURIÓ com Educador' and deleted_at is null);
