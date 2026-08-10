-- CURIÓ · Modelos prontos com contexto real de Agenda e Missões.
-- Reaproveita content_templates existente; não cria sistema paralelo de comunicação.

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
      'Aula marcada',
      'Aviso com data e horário de uma aula já cadastrada na Agenda.',
      jsonb_build_object(
        'curio_code','COM-05',
        'subject','Aula de {{aluno.nome}} em {{agenda.data}}',
        'body','Olá, {{responsavel.nome}}! A aula de {{aluno.nome}} está marcada para {{agenda.data}}, às {{agenda.horario}}. Os detalhes e o acesso ficam na Agenda da Família. — {{professor.nome}}',
        'variables',jsonb_build_array('responsavel.nome','aluno.nome','professor.nome','agenda.data','agenda.horario'),
        'context_kind','agenda',
        'action_label','Ver agenda',
        'action_url','/familia/agenda',
        'category','agenda'
      )
    ),
    (
      'Reunião marcada com detalhes',
      'Convite de reunião preenchido a partir de um encontro real da Agenda.',
      jsonb_build_object(
        'curio_code','COM-06',
        'subject','Reunião sobre {{aluno.nome}} em {{agenda.data}}',
        'body','Olá, {{responsavel.nome}}! Nossa reunião sobre {{aluno.nome}} está marcada para {{agenda.data}}, às {{agenda.horario}}. Consulte a Agenda da Família para os detalhes e o link de acesso. — {{professor.nome}}',
        'variables',jsonb_build_array('responsavel.nome','aluno.nome','professor.nome','agenda.data','agenda.horario'),
        'context_kind','agenda',
        'action_label','Abrir reunião',
        'action_url','/familia/agenda',
        'category','reuniao'
      )
    ),
    (
      'Prazo de missão próximo',
      'Lembrete de prazo preenchido a partir de uma missão realmente atribuída ao aluno.',
      jsonb_build_object(
        'curio_code','COM-07',
        'subject','Prazo da missão {{missao.nome}}',
        'body','Olá, {{responsavel.nome}}! A missão “{{missao.nome}}”, de {{aluno.nome}}, tem prazo em {{missao.prazo}}. O lembrete é apenas para apoiar a organização e a autonomia. — {{professor.nome}}',
        'variables',jsonb_build_array('responsavel.nome','aluno.nome','professor.nome','missao.nome','missao.prazo'),
        'context_kind','mission',
        'action_label','Ver atividades',
        'action_url','/familia/atividades',
        'category','pedagogico'
      )
    ),
    (
      'Ausência registrada',
      'Mensagem editável para comunicar ausência sem expor informação administrativa interna.',
      jsonb_build_object(
        'curio_code','COM-08',
        'subject','Acompanhamento de {{aluno.nome}}',
        'body','Olá, {{responsavel.nome}}! Hoje registramos a ausência de {{aluno.nome}} em uma atividade/encontro previsto. Se houver alguma informação importante para alinharmos, você pode responder por aqui. — {{professor.nome}}',
        'variables',jsonb_build_array('responsavel.nome','aluno.nome','professor.nome'),
        'category','presenca'
      )
    ),
    (
      'Alteração de encontro',
      'Aviso editável de alteração/cancelamento baseado em um encontro real da Agenda.',
      jsonb_build_object(
        'curio_code','COM-09',
        'subject','Atualização no encontro de {{aluno.nome}}',
        'body','Olá, {{responsavel.nome}}! Houve uma atualização no encontro “{{agenda.titulo}}” de {{aluno.nome}}, previsto para {{agenda.data}} às {{agenda.horario}}. Confira a Agenda da Família antes do horário combinado. — {{professor.nome}}',
        'variables',jsonb_build_array('responsavel.nome','aluno.nome','professor.nome','agenda.titulo','agenda.data','agenda.horario'),
        'context_kind','agenda',
        'action_label','Ver agenda',
        'action_url','/familia/agenda',
        'category','agenda'
      )
    )
) as seed(name, description, config)
where not exists (
  select 1
  from public.content_templates ct
  where ct.template_type = 'communication'
    and ct.config->>'curio_code' = seed.config->>'curio_code'
);
