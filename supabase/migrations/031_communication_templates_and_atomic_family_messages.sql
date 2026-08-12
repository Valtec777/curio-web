-- CURIÓ · Mensagens internas reutilizáveis, variáveis e envio atômico Professor/Admin → Família.
-- Reaproveita content_templates, message_threads, message_thread_participants e messages existentes.

alter table public.message_threads
  add column if not exists context_student_id uuid references public.students(id) on delete set null;

alter table public.messages
  add column if not exists action_label text,
  add column if not exists action_url text,
  add column if not exists request_key text;

alter table public.messages
  drop constraint if exists messages_action_label_length_check,
  add constraint messages_action_label_length_check
    check (action_label is null or char_length(action_label) between 1 and 80),
  drop constraint if exists messages_action_url_safe_check,
  add constraint messages_action_url_safe_check
    check (
      action_url is null
      or (
        char_length(action_url) <= 500
        and (action_url like '/%' or action_url like 'https://%')
      )
    ),
  drop constraint if exists messages_request_key_length_check,
  add constraint messages_request_key_length_check
    check (request_key is null or char_length(request_key) between 8 and 160);

create unique index if not exists messages_sender_request_key_uidx
  on public.messages(sender_user_id, request_key)
  where request_key is not null;

create index if not exists message_threads_context_student_idx
  on public.message_threads(context_student_id)
  where context_student_id is not null;

drop policy if exists templates_select on public.content_templates;
create policy templates_select
on public.content_templates
for select
to authenticated
using (
  (select private.has_role('admin'::public.app_role))
  or (
    created_by_user_id = (select auth.uid())
    and (
      template_type <> 'communication'
      or (select private.has_role('teacher'::public.app_role))
    )
  )
  or (
    shared = true
    and (
      template_type <> 'communication'
      or (select private.has_role('teacher'::public.app_role))
    )
  )
);

drop policy if exists templates_write on public.content_templates;
create policy templates_write
on public.content_templates
for all
to authenticated
using (
  (select private.has_role('admin'::public.app_role))
  or (
    created_by_user_id = (select auth.uid())
    and (
      template_type <> 'communication'
      or (select private.has_role('teacher'::public.app_role))
    )
  )
)
with check (
  (select private.has_role('admin'::public.app_role))
  or (
    created_by_user_id = (select auth.uid())
    and (
      template_type <> 'communication'
      or (select private.has_role('teacher'::public.app_role))
    )
  )
);

create or replace function public.send_curio_family_message(
  p_student_id uuid,
  p_guardian_id uuid,
  p_subject text,
  p_body text,
  p_action_label text default null,
  p_action_url text default null,
  p_request_key text default null
)
returns table(thread_id uuid, message_id uuid, reused boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender uuid := auth.uid();
  v_guardian_user_id uuid;
  v_thread_id uuid;
  v_message_id uuid;
  v_is_admin boolean := false;
  v_is_teacher boolean := false;
  v_request_key text := nullif(btrim(p_request_key), '');
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_action_label text := nullif(btrim(coalesce(p_action_label, '')), '');
  v_action_url text := nullif(btrim(coalesce(p_action_url, '')), '');
begin
  if v_sender is null then
    raise exception 'authentication required';
  end if;

  v_is_admin := private.has_role('admin'::public.app_role);
  v_is_teacher := private.has_role('teacher'::public.app_role);

  if not v_is_admin and not v_is_teacher then
    raise exception 'team role required';
  end if;

  if char_length(v_subject) < 2 or char_length(v_subject) > 160 then
    raise exception 'invalid subject';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 5000 then
    raise exception 'invalid body';
  end if;
  if v_request_key is null or char_length(v_request_key) < 8 or char_length(v_request_key) > 160 then
    raise exception 'invalid request key';
  end if;
  if v_action_label is not null and char_length(v_action_label) > 80 then
    raise exception 'invalid action label';
  end if;
  if v_action_url is not null and not (v_action_url like '/%' or v_action_url like 'https://%') then
    raise exception 'invalid action url';
  end if;
  if (v_action_label is null) <> (v_action_url is null) then
    raise exception 'action label and url must be provided together';
  end if;

  if not exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and s.deleted_at is null
      and s.status <> 'inactive'
  ) then
    raise exception 'student unavailable';
  end if;

  select g.profile_id
    into v_guardian_user_id
  from public.guardians g
  join public.guardian_students gs
    on gs.guardian_id = g.id
   and gs.student_id = p_student_id
  where g.id = p_guardian_id
    and g.active = true
  limit 1;

  if v_guardian_user_id is null then
    raise exception 'guardian is not linked to student';
  end if;

  if not v_is_admin and not private.teacher_has_student(p_student_id) then
    raise exception 'student is not linked to this teacher';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('curio-message-request:' || v_sender::text || ':' || v_request_key, 0)
  );

  select m.thread_id, m.id
    into v_thread_id, v_message_id
  from public.messages m
  where m.sender_user_id = v_sender
    and m.request_key = v_request_key
  limit 1;

  if v_message_id is not null then
    return query select v_thread_id, v_message_id, true;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'curio-family-thread:' || p_student_id::text || ':' || v_sender::text || ':' || v_guardian_user_id::text,
      0
    )
  );

  select mt.id
    into v_thread_id
  from public.message_threads mt
  where mt.thread_type = 'family'
    and mt.context_student_id = p_student_id
    and exists (
      select 1 from public.message_thread_participants mp
      where mp.thread_id = mt.id and mp.user_id = v_sender
    )
    and exists (
      select 1 from public.message_thread_participants mp
      where mp.thread_id = mt.id and mp.user_id = v_guardian_user_id
    )
    and 2 = (
      select count(*) from public.message_thread_participants mp
      where mp.thread_id = mt.id
    )
  order by mt.created_at
  limit 1;

  if v_thread_id is null then
    insert into public.message_threads(subject, thread_type, context_student_id)
    values (v_subject, 'family', p_student_id)
    returning id into v_thread_id;

    insert into public.message_thread_participants(thread_id, user_id)
    values
      (v_thread_id, v_sender),
      (v_thread_id, v_guardian_user_id)
    on conflict (thread_id, user_id) do nothing;
  else
    update public.message_threads
    set subject = v_subject,
        updated_at = now()
    where id = v_thread_id;
  end if;

  insert into public.messages(
    thread_id,
    sender_user_id,
    body,
    action_label,
    action_url,
    request_key
  )
  values (
    v_thread_id,
    v_sender,
    v_body,
    v_action_label,
    v_action_url,
    v_request_key
  )
  on conflict (sender_user_id, request_key)
    where request_key is not null
  do update set request_key = excluded.request_key
  returning id into v_message_id;

  update public.message_threads
  set updated_at = now()
  where id = v_thread_id;

  return query select v_thread_id, v_message_id, false;
end;
$$;

revoke all on function public.send_curio_family_message(uuid,uuid,text,text,text,text,text) from public;
revoke all on function public.send_curio_family_message(uuid,uuid,text,text,text,text,text) from anon;
grant execute on function public.send_curio_family_message(uuid,uuid,text,text,text,text,text) to authenticated;

insert into public.content_templates(
  created_by_user_id,
  name,
  template_type,
  description,
  config,
  shared,
  active
)
select null,
       seed.name,
       'communication',
       seed.description,
       seed.config,
       true,
       true
from (
  values
    (
      'Lembrete de encontro',
      'Mensagem curta para lembrar a família de consultar a agenda.',
      jsonb_build_object(
        'curio_code','COM-01',
        'subject','Novo encontro de {{aluno_nome}}',
        'body','Olá, {{responsavel_nome}}! Há um novo encontro do CURIÓ na agenda de {{aluno_nome}}. Você pode consultar os detalhes e o link de acesso na Agenda da Família. — {{professor_nome}}',
        'variables',jsonb_build_array('responsavel_nome','aluno_nome','professor_nome'),
        'action_label','Ver agenda',
        'action_url','/familia/agenda',
        'category','agenda'
      )
    ),
    (
      'Missão disponível',
      'Aviso de nova Missão Cuca para acompanhamento da família.',
      jsonb_build_object(
        'curio_code','COM-02',
        'subject','Nova Missão Cuca para {{aluno_nome}}',
        'body','Olá, {{responsavel_nome}}! Uma nova Missão Cuca foi preparada para {{aluno_nome}}. O objetivo é apoiar o avanço com autonomia, sem transformar a atividade em cobrança. — {{professor_nome}}',
        'variables',jsonb_build_array('responsavel_nome','aluno_nome','professor_nome'),
        'action_label','Ver atividades',
        'action_url','/familia/atividades',
        'category','pedagogico'
      )
    ),
    (
      'Devolutiva positiva',
      'Mensagem breve para compartilhar um avanço observado.',
      jsonb_build_object(
        'curio_code','COM-03',
        'subject','Um avanço de {{aluno_nome}}',
        'body','Olá, {{responsavel_nome}}! Quero compartilhar um avanço de {{aluno_nome}} observado no acompanhamento. Vale reconhecer o processo e a estratégia que funcionou; seguimos consolidando esse aprendizado com calma. — {{professor_nome}}',
        'variables',jsonb_build_array('responsavel_nome','aluno_nome','professor_nome'),
        'category','devolutiva'
      )
    ),
    (
      'Reunião com a família',
      'Convite para a família consultar uma reunião cadastrada na agenda.',
      jsonb_build_object(
        'curio_code','COM-04',
        'subject','Reunião sobre {{aluno_nome}}',
        'body','Olá, {{responsavel_nome}}! Registrei uma reunião sobre o acompanhamento de {{aluno_nome}}. Os detalhes, horário e link ficam na Agenda da Família. — {{professor_nome}}',
        'variables',jsonb_build_array('responsavel_nome','aluno_nome','professor_nome'),
        'action_label','Abrir reunião',
        'action_url','/familia/agenda',
        'category','reuniao'
      )
    )
) as seed(name, description, config)
where not exists (
  select 1
  from public.content_templates ct
  where ct.template_type = 'communication'
    and ct.config->>'curio_code' = seed.config->>'curio_code'
);