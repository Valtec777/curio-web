-- CURIÓ v1 — Operação administrativa complementar
-- Módulos: ocorrências, mídia, auditoria, acessos, suporte e configuração de notas.

create table if not exists public.student_occurrences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  occurrence_type text not null default 'observation' check (occurrence_type in ('observation','positive','attention','behavior','attendance','other')),
  title text not null,
  description text not null,
  severity smallint not null default 1 check (severity between 1 and 3),
  status text not null default 'open' check (status in ('open','monitoring','resolved')),
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by_user_id uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_occurrences_student_idx on public.student_occurrences(student_id, occurred_at desc);
create index if not exists student_occurrences_status_idx on public.student_occurrences(status, occurred_at desc);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'other',
  file_path text,
  external_url text,
  mime_type text,
  alt_text text,
  source_entity_type text,
  source_entity_id uuid,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (file_path is not null or external_url is not null)
);

create unique index if not exists media_assets_file_path_uidx on public.media_assets(file_path) where file_path is not null;
create index if not exists media_assets_category_idx on public.media_assets(category, active);

create table if not exists public.system_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('insert','update','delete')),
  entity_type text not null,
  entity_id text,
  changed_columns text[],
  created_at timestamptz not null default now()
);

create index if not exists system_audit_logs_created_idx on public.system_audit_logs(created_at desc);
create index if not exists system_audit_logs_entity_idx on public.system_audit_logs(entity_type, created_at desc);

create table if not exists public.access_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('login','logout')),
  route text,
  occurred_at timestamptz not null default now()
);

create index if not exists access_events_user_idx on public.access_events(user_id, occurred_at desc);
create index if not exists access_events_occurred_idx on public.access_events(occurred_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  opened_by_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  assigned_to_user_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  description text not null,
  category text not null default 'general',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','waiting','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists support_tickets_status_idx on public.support_tickets(status, created_at desc);
create index if not exists support_tickets_opened_by_idx on public.support_tickets(opened_by_user_id, created_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_idx on public.support_ticket_messages(ticket_id, created_at);

create table if not exists public.grading_schemes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  scale_min numeric not null default 0,
  scale_max numeric not null default 10,
  passing_score numeric,
  active boolean not null default true,
  created_by_user_id uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scale_max > scale_min),
  check (passing_score is null or (passing_score >= scale_min and passing_score <= scale_max))
);

create table if not exists public.grading_bands (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.grading_schemes(id) on delete cascade,
  label text not null,
  min_score numeric not null,
  max_score numeric not null,
  color_key text not null default 'blue',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (max_score >= min_score)
);

create index if not exists grading_bands_scheme_idx on public.grading_bands(scheme_id, sort_order);

alter table public.assessments
  add column if not exists grading_scheme_id uuid references public.grading_schemes(id) on delete set null;

-- Updated-at padronizado.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='touch_updated_at') then
    if not exists (select 1 from pg_trigger where tgname='touch_student_occurrences_updated_at') then
      create trigger touch_student_occurrences_updated_at before update on public.student_occurrences for each row execute function public.touch_updated_at();
    end if;
    if not exists (select 1 from pg_trigger where tgname='touch_media_assets_updated_at') then
      create trigger touch_media_assets_updated_at before update on public.media_assets for each row execute function public.touch_updated_at();
    end if;
    if not exists (select 1 from pg_trigger where tgname='touch_support_tickets_updated_at') then
      create trigger touch_support_tickets_updated_at before update on public.support_tickets for each row execute function public.touch_updated_at();
    end if;
    if not exists (select 1 from pg_trigger where tgname='touch_grading_schemes_updated_at') then
      create trigger touch_grading_schemes_updated_at before update on public.grading_schemes for each row execute function public.touch_updated_at();
    end if;
  end if;
end $$;

-- RLS
alter table public.student_occurrences enable row level security;
alter table public.media_assets enable row level security;
alter table public.system_audit_logs enable row level security;
alter table public.access_events enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.grading_schemes enable row level security;
alter table public.grading_bands enable row level security;

-- Ocorrências são internas: admin ou professor vinculado. Não há política de leitura para aluno/família.
drop policy if exists occurrences_admin_all on public.student_occurrences;
create policy occurrences_admin_all on public.student_occurrences for all to authenticated
  using (private.has_role('admin'::app_role))
  with check (private.has_role('admin'::app_role));

drop policy if exists occurrences_teacher_select on public.student_occurrences;
create policy occurrences_teacher_select on public.student_occurrences for select to authenticated
  using (private.has_role('teacher'::app_role) and private.teacher_has_student(student_id));

drop policy if exists occurrences_teacher_insert on public.student_occurrences;
create policy occurrences_teacher_insert on public.student_occurrences for insert to authenticated
  with check (
    private.has_role('teacher'::app_role)
    and private.teacher_has_student(student_id)
    and teacher_id = private.teacher_id_for_user()
    and created_by_user_id = auth.uid()
  );

drop policy if exists occurrences_teacher_update on public.student_occurrences;
create policy occurrences_teacher_update on public.student_occurrences for update to authenticated
  using (private.has_role('teacher'::app_role) and private.teacher_has_student(student_id) and teacher_id = private.teacher_id_for_user())
  with check (private.has_role('teacher'::app_role) and private.teacher_has_student(student_id) and teacher_id = private.teacher_id_for_user());

-- Biblioteca de mídia: leitura autenticada dos ativos; administração controla cadastro e inativação.
drop policy if exists media_assets_read on public.media_assets;
create policy media_assets_read on public.media_assets for select to authenticated
  using (active = true or private.has_role('admin'::app_role));

drop policy if exists media_assets_admin_write on public.media_assets;
create policy media_assets_admin_write on public.media_assets for all to authenticated
  using (private.has_role('admin'::app_role))
  with check (private.has_role('admin'::app_role));

-- Auditoria: somente admin lê. Escrita é feita apenas pelo trigger security definer.
drop policy if exists audit_admin_select on public.system_audit_logs;
create policy audit_admin_select on public.system_audit_logs for select to authenticated
  using (private.has_role('admin'::app_role));

-- Acessos: o usuário registra o próprio login/logout; admin monitora.
drop policy if exists access_admin_select on public.access_events;
create policy access_admin_select on public.access_events for select to authenticated
  using (private.has_role('admin'::app_role));

drop policy if exists access_self_insert on public.access_events;
create policy access_self_insert on public.access_events for insert to authenticated
  with check (user_id = auth.uid());

-- Suporte: cada usuário vê o que abriu; admin vê e gerencia todos.
drop policy if exists support_tickets_admin_all on public.support_tickets;
create policy support_tickets_admin_all on public.support_tickets for all to authenticated
  using (private.has_role('admin'::app_role))
  with check (private.has_role('admin'::app_role));

drop policy if exists support_tickets_self_select on public.support_tickets;
create policy support_tickets_self_select on public.support_tickets for select to authenticated
  using (opened_by_user_id = auth.uid() or assigned_to_user_id = auth.uid());

drop policy if exists support_tickets_self_insert on public.support_tickets;
create policy support_tickets_self_insert on public.support_tickets for insert to authenticated
  with check (opened_by_user_id = auth.uid());

drop policy if exists support_messages_admin_all on public.support_ticket_messages;
create policy support_messages_admin_all on public.support_ticket_messages for all to authenticated
  using (private.has_role('admin'::app_role))
  with check (private.has_role('admin'::app_role));

drop policy if exists support_messages_participant_select on public.support_ticket_messages;
create policy support_messages_participant_select on public.support_ticket_messages for select to authenticated
  using (exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and (t.opened_by_user_id = auth.uid() or t.assigned_to_user_id = auth.uid())
  ));

drop policy if exists support_messages_participant_insert on public.support_ticket_messages;
create policy support_messages_participant_insert on public.support_ticket_messages for insert to authenticated
  with check (
    sender_user_id = auth.uid() and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (t.opened_by_user_id = auth.uid() or t.assigned_to_user_id = auth.uid())
    )
  );

-- Escalas de nota ficam separadas do mapa pedagógico (domínio/autonomia/confiança).
drop policy if exists grading_schemes_read on public.grading_schemes;
create policy grading_schemes_read on public.grading_schemes for select to authenticated
  using (active = true or private.has_role('admin'::app_role));

drop policy if exists grading_schemes_admin_write on public.grading_schemes;
create policy grading_schemes_admin_write on public.grading_schemes for all to authenticated
  using (private.has_role('admin'::app_role))
  with check (private.has_role('admin'::app_role));

drop policy if exists grading_bands_read on public.grading_bands;
create policy grading_bands_read on public.grading_bands for select to authenticated
  using (exists (select 1 from public.grading_schemes s where s.id = scheme_id and (s.active = true or private.has_role('admin'::app_role))));

drop policy if exists grading_bands_admin_write on public.grading_bands;
create policy grading_bands_admin_write on public.grading_bands for all to authenticated
  using (private.has_role('admin'::app_role))
  with check (private.has_role('admin'::app_role));

-- Escala inicial sem confundir nota acadêmica com diagnóstico pedagógico.
insert into public.grading_schemes (name, scale_min, scale_max, passing_score, active, created_by_user_id)
select 'Escala numérica 0–10', 0, 10, 6, true, null
where not exists (select 1 from public.grading_schemes where name='Escala numérica 0–10');

insert into public.grading_bands (scheme_id, label, min_score, max_score, color_key, sort_order)
select s.id, v.label, v.min_score, v.max_score, v.color_key, v.sort_order
from public.grading_schemes s
cross join (values
  ('Atenção', 0::numeric, 5.9::numeric, 'pink'::text, 1),
  ('Em desenvolvimento', 6::numeric, 7.9::numeric, 'yellow'::text, 2),
  ('Bom domínio', 8::numeric, 8.9::numeric, 'blue'::text, 3),
  ('Excelente', 9::numeric, 10::numeric, 'green'::text, 4)
) as v(label,min_score,max_score,color_key,sort_order)
where s.name='Escala numérica 0–10'
  and not exists (select 1 from public.grading_bands b where b.scheme_id=s.id);

-- Reaproveita arquivos já existentes de mascotes e materiais, sem duplicar os bytes.
insert into public.media_assets (name, category, file_path, alt_text, source_entity_type, source_entity_id, active, metadata, created_by_user_id)
select c.name || ' · ' || e.key,
       case when e.key='sticker' then 'sticker' else 'mascot' end,
       e.value,
       c.name,
       'character',
       c.id,
       c.active,
       jsonb_build_object('variant', e.key, 'trait', c.pedagogical_trait),
       null
from public.characters c
cross join lateral jsonb_each_text(coalesce(c.assets,'{}'::jsonb)) e
where e.value is not null and e.value <> ''
on conflict (file_path) where file_path is not null do nothing;

insert into public.media_assets (name, category, file_path, alt_text, source_entity_type, source_entity_id, active, created_by_user_id)
select m.title, 'material', m.file_path, m.title, 'material', m.id, (m.status <> 'archived'), null
from public.materials m
where m.file_path is not null and m.file_path <> ''
on conflict (file_path) where file_path is not null do nothing;

-- Auditoria sem copiar dados pessoais: guarda apenas entidade, ID, ação e nomes das colunas alteradas.
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  row_data jsonb;
  old_data jsonb;
  changed text[];
begin
  row_data := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_data := case when tg_op='UPDATE' then to_jsonb(old) else null end;

  if tg_op='UPDATE' then
    select coalesce(array_agg(n.key order by n.key), array[]::text[])
      into changed
    from jsonb_each(row_data) n
    join jsonb_each(old_data) o using (key)
    where n.value is distinct from o.value;
  else
    changed := null;
  end if;

  insert into public.system_audit_logs(actor_user_id, action, entity_type, entity_id, changed_columns)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(row_data->>'id', row_data->>'key'),
    changed
  );

  return case when tg_op='DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_row_change() from public;

do $$
declare
  t text;
  tables_to_audit text[] := array[
    'profiles','students','teachers','guardians','classes','plans','subscriptions','payments',
    'materials','characters','agenda_events','generated_reports','student_occurrences','media_assets',
    'support_tickets','grading_schemes','grading_bands','content_templates','announcements','app_settings'
  ];
begin
  foreach t in array tables_to_audit loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_%I_changes on public.%I', t, t);
      execute format('create trigger audit_%I_changes after insert or update or delete on public.%I for each row execute function private.audit_row_change()', t, t);
    end if;
  end loop;
end $$;
