-- CURIÓ — fontes do gerador e contratos oficiais de modelo
-- Mantém arquivos privados, exige revisão humana e não publica geração automaticamente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generation-sources',
  'generation-sources',
  false,
  10485760,
  array['application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-documents',
  'generated-documents',
  false,
  20971520,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Professor/usuário autenticado só manipula a própria pasta. Admin pode consultar para suporte e auditoria.
drop policy if exists "generation_sources_own_select" on storage.objects;
create policy "generation_sources_own_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'generation-sources'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.has_role('admin'::app_role)
  )
);

drop policy if exists "generation_sources_own_insert" on storage.objects;
create policy "generation_sources_own_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'generation-sources'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "generation_sources_own_delete" on storage.objects;
create policy "generation_sources_own_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'generation-sources'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.has_role('admin'::app_role)
  )
);

drop policy if exists "generated_documents_visible" on storage.objects;
create policy "generated_documents_visible"
on storage.objects for select to authenticated
using (
  bucket_id = 'generated-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.has_role('admin'::app_role)
  )
);

-- Contratos oficiais lidos dos arquivos "Modelo Visual" da pasta DOCS CURIO.
insert into public.content_templates (name, template_type, description, config, shared, active)
select * from (values
  (
    'Missão Cuca — ATV-01',
    'mission',
    'Contrato oficial de Missão Cuca. A IA prepara rascunho e o professor revisa antes da publicação.',
    jsonb_build_object(
      'curio_source_code','ATV-01',
      'source_drive_file_id','1ppPTnEPhiHBlMqbtleJYM_8nT9UcGJP6',
      'teacher_review_required',true,
      'auto_publish',false,
      'sections',jsonb_build_array('Objetivo da missão','Primeiro, vamos entender','Explicação curta','Exemplo','Agora é sua vez','Pista','Agora é no Caderno Curió','Explique com suas palavras')
    ),
    true,true
  ),
  (
    'Diagnóstico Inicial — PED-01',
    'assessment',
    'Diagnóstico orientado por evidências, sem rotular a criança.',
    jsonb_build_object(
      'curio_source_code','PED-01',
      'source_drive_file_id','1GtFPt6Wzb-uircobjiaJIj3bpmI4m_jw',
      'teacher_review_required',true,
      'sections',jsonb_build_array('Contexto escolar','Percepção da família','Leitura e interpretação','Escrita e produção textual','Organização e modo de aprender','Síntese diagnóstica','Prioridades para os primeiros 30 dias')
    ),
    true,true
  ),
  (
    'Plano de Aprendizagem 30 Dias — PRO-01',
    'report',
    'Plano de ciclo com objetivos observáveis, indicadores, semanas e revisão.',
    jsonb_build_object(
      'curio_source_code','PRO-01',
      'source_drive_file_id','1QxtE9D7eYLjWg13CCygi2Kh3lEsq_axM',
      'teacher_review_required',true,
      'sections',jsonb_build_array('Ponto de partida','Objetivos e evidências','Plano semanal','Recursos','O que vamos observar','Revisão do ciclo')
    ),
    true,true
  ),
  (
    'Registro Pós-Encontro — PED-03',
    'report',
    'Registro do encontro com evidência, estratégia, Caderno Curió e próxima ação.',
    jsonb_build_object(
      'curio_source_code','PED-03',
      'source_drive_file_id','1Znu9p8YRWZtyFtGDx9-YvsWPrVm0RsqT',
      'teacher_review_required',true,
      'sections',jsonb_build_array('Conteúdo trabalhado','Objetivo do encontro','Como a criança respondeu','Dificuldade observada','Estratégia que funcionou','Caderno Curió','Próxima ação','Comunicação com a família','Tempos operacionais')
    ),
    true,true
  ),
  (
    'Relatório Mensal da Família — REL-01',
    'report',
    'Relatório mensal em linguagem compreensível, baseado em evidências do ciclo.',
    jsonb_build_object(
      'curio_source_code','REL-01',
      'source_drive_file_id','1gvFxCqC-VmVyWyRdLfDkLqv-xBUgYNdV',
      'teacher_review_required',true,
      'sections',jsonb_build_array('Resumo do ciclo','O que foi trabalhado','O que avançou','Em acompanhamento','Autonomia e participação','Próximo ciclo','Para a família')
    ),
    true,true
  ),
  (
    'Ficha Individual do Aluno — PED-02',
    'report',
    'Ficha individual com contexto, perfil de aprendizagem, metas e acompanhamento.',
    jsonb_build_object(
      'curio_source_code','PED-02',
      'source_drive_file_id','1dw--9tQmZrLG_DVqDk8uvUaCBXwC64mP',
      'teacher_review_required',true,
      'minimum_personal_data',true,
      'sections',jsonb_build_array('Responsáveis autorizados','Contexto escolar e familiar','Diagnóstico e perfil de aprendizagem','Metas do ciclo atual','Plano em andamento','Acompanhamento','Progresso e próximo ciclo','Notas internas necessárias')
    ),
    true,true
  ),
  (
    'Questionário Inicial da Família — FAM-01',
    'assessment',
    'Questionário inicial sobre rotina, facilidades, dificuldades, autonomia e expectativas.',
    jsonb_build_object(
      'curio_source_code','FAM-01',
      'source_drive_file_id','1F__cBGoumYgVhHHLNzUQlUHyXXJsr_WO',
      'teacher_review_required',true,
      'minimum_personal_data',true,
      'sections',jsonb_build_array('Rotina de estudos','Conteúdos com mais dificuldade','Conteúdos com mais facilidade','Leitura e escrita','Autonomia','Organização','Motivação e interesses','Tecnologia','Expectativas da família','Informações adicionais')
    ),
    true,true
  ),
  (
    'Checklist de Matrícula — ADM-01',
    'material',
    'Checklist interno de cadastro, contrato, acesso, onboarding e pedagógico.',
    jsonb_build_object(
      'curio_source_code','ADM-01',
      'source_drive_file_id','15PJaSxiqo3iqnyF1O2ptJE-y00KLlBPO',
      'teacher_review_required',false,
      'sections',jsonb_build_array('Cadastro','Contrato e pagamento','Acesso e onboarding','Pedagógico','Pendências','Decisão')
    ),
    true,true
  ),
  (
    'Ficha de Matrícula Operacional — ADM-02',
    'material',
    'Ficha operacional editável de matrícula, responsáveis, permissões, plano e onboarding.',
    jsonb_build_object(
      'curio_source_code','ADM-02',
      'source_drive_file_id','1xq5Tv5j-Em20reYJX4msdu75bVfIDobi',
      'teacher_review_required',false,
      'sections',jsonb_build_array('Dados da criança','Responsáveis e permissões','Plano e agenda','Contrato e financeiro','Onboarding','Pendência principal')
    ),
    true,true
  ),
  (
    'Fluxo Operacional do Aluno Piloto — OPS-01',
    'material',
    'Percurso controlado da família piloto do convite ao fechamento semanal.',
    jsonb_build_object(
      'curio_source_code','OPS-01',
      'source_drive_file_id','1_ZoO0g5ZjR21hYAysnpQ2ibO7xXqaPhq',
      'teacher_review_required',false,
      'sections',jsonb_build_array('Convite e aceite','Matrícula','Contrato e pagamento','Primeiro acesso','Modo criança','Questionário e diagnóstico','Plano de 30 dias','Missão Cuca','Encontro online','Caderno Curió','Mensagens e agenda','Relatório e feedback','Bugs e custos de tempo','Fechamento da semana')
    ),
    true,true
  )
) as source(name, template_type, description, config, shared, active)
where not exists (
  select 1 from public.content_templates ct
  where ct.config->>'curio_source_code' = source.config->>'curio_source_code'
);
