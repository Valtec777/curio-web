-- CURIÓ · experiência do aluno
-- Catálogo de conquistas, regras automáticas e envio seguro do Caderno Curió.

alter table public.achievements
  add column if not exists unlock_hint text,
  add column if not exists sort_order integer not null default 0;

create table if not exists public.achievement_rules (
  achievement_id uuid primary key references public.achievements(id) on delete cascade,
  rule_type text not null check (rule_type in (
    'reviewed_missions','notebooks_submitted','streak_days','stars','improvements',
    'perfect_missions','distinct_subjects','courses_completed','active_days','open_answers'
  )),
  threshold integer not null check (threshold > 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.achievement_rules enable row level security;

drop policy if exists achievement_rules_read on public.achievement_rules;
create policy achievement_rules_read on public.achievement_rules
for select to authenticated using (true);

drop policy if exists achievement_rules_admin_write on public.achievement_rules;
create policy achievement_rules_admin_write on public.achievement_rules
for all to authenticated
using (private.has_role('admin'::app_role))
with check (private.has_role('admin'::app_role));

insert into public.achievements (slug,name,description,icon,color_key,active,unlock_hint,sort_order)
values
('calma-da-capivara','Calma da Capivara','Respirou, tentou de novo e melhorou o resultado.','heart','green',true,'Melhore seu resultado em uma missão.',1),
('voz-da-arara','Voz da Arara','Explicou uma ideia com suas próprias palavras.','message','pink',true,'Responda uma questão aberta com suas palavras.',2),
('imaginacao-do-boto','Imaginação do Boto','Usou criatividade para construir uma resposta.','sparkles','purple',true,'Pratique respostas abertas em diferentes missões.',3),
('pratica-do-mico','Prática do Mico','Fez uma atividade do Caderno Curió.','pencil','yellow',true,'Envie sua primeira atividade do Caderno Curió.',4),
('olhos-do-tamandua','Olhos do Tamanduá','Investigou conteúdos de mais de uma matéria.','search','blue',true,'Explore atividades em duas matérias diferentes.',5),
('coragem-da-onca','Coragem da Onça','Voltou a desafios difíceis e conseguiu evoluir.','shield','orange',true,'Melhore seu resultado em três missões.',6),
('voo-da-harpia','Voo da Harpia','Concluiu uma etapa importante da jornada.','trophy','blue',true,'Conclua dez Missões Cuca.',7),
('primeira-descoberta','Primeira Descoberta','Concluiu a primeira Missão Cuca.','star','lime',true,'Conclua sua primeira missão.',8),
('trilha-de-tres','Trilha de Três','Já completou três Missões Cuca.','star','lime',true,'Conclua três missões.',9),
('cinco-passos','Cinco Passos','Chegou a cinco missões concluídas.','star','lime',true,'Conclua cinco missões.',10),
('dez-descobertas','Dez Descobertas','Somou dez missões concluídas.','trophy','blue',true,'Conclua dez missões.',11),
('vinte-descobertas','Vinte Descobertas','Construiu uma trilha de vinte missões.','trophy','purple',true,'Conclua vinte missões.',12),
('cinquenta-descobertas','Explorador de Cinquenta','Chegou a cinquenta missões concluídas.','trophy','pink',true,'Conclua cinquenta missões.',13),
('cem-descobertas','Cem Descobertas','Alcançou cem missões concluídas.','trophy','gold',true,'Conclua cem missões.',14),
('primeira-pagina','Primeira Página','Enviou a primeira atividade do Caderno Curió.','notebook','yellow',true,'Envie uma atividade do caderno.',15),
('caderno-3','Caderno em Movimento','Já enviou três atividades feitas fora da tela.','notebook','yellow',true,'Envie três atividades do caderno.',16),
('caderno-5','Mão na Massa','Chegou a cinco atividades de caderno enviadas.','notebook','orange',true,'Envie cinco atividades do caderno.',17),
('caderno-10','Caderno Companheiro','Somou dez atividades de caderno.','notebook','purple',true,'Envie dez atividades do caderno.',18),
('caderno-20','Mestre do Caderno','Chegou a vinte atividades de caderno.','notebook','blue',true,'Envie vinte atividades do caderno.',19),
('sequencia-2','Dois Dias de Curiosidade','Voltou ao CURIÓ por dois dias seguidos.','fire','orange',true,'Mantenha uma sequência de dois dias.',20),
('sequencia-3','Três Dias de Descoberta','Manteve três dias seguidos de estudo.','fire','orange',true,'Mantenha uma sequência de três dias.',21),
('sequencia-5','Cinco Dias em Movimento','Manteve cinco dias seguidos de atividade.','fire','pink',true,'Mantenha uma sequência de cinco dias.',22),
('sequencia-7','Semana Curiosa','Completou sete dias seguidos.','fire','purple',true,'Mantenha uma sequência de sete dias.',23),
('sequencia-14','Duas Semanas de Jornada','Chegou a quatorze dias seguidos.','fire','blue',true,'Mantenha uma sequência de quatorze dias.',24),
('sequencia-30','Mês de Descobertas','Alcançou trinta dias seguidos de jornada.','fire','gold',true,'Mantenha uma sequência de trinta dias.',25),
('estrelas-10','Primeiro Céu','Conquistou dez estrelas.','star','yellow',true,'Junte dez estrelas.',26),
('estrelas-25','Céu Brilhante','Conquistou vinte e cinco estrelas.','star','yellow',true,'Junte vinte e cinco estrelas.',27),
('estrelas-50','Constelação Curió','Conquistou cinquenta estrelas.','star','purple',true,'Junte cinquenta estrelas.',28),
('estrelas-100','Cem Estrelas','Chegou a cem estrelas.','star','blue',true,'Junte cem estrelas.',29),
('estrelas-250','Céu Explorador','Chegou a duzentas e cinquenta estrelas.','star','pink',true,'Junte 250 estrelas.',30),
('estrelas-500','Galáxia Curió','Chegou a quinhentas estrelas.','star','gold',true,'Junte 500 estrelas.',31),
('melhora-1','Tente Outra Vez','Melhorou o resultado depois de uma nova tentativa.','refresh','green',true,'Melhore seu resultado em uma missão.',32),
('melhora-3','Aprender é Ajustar','Melhorou o resultado em três missões.','refresh','green',true,'Melhore em três missões.',33),
('melhora-5','Evolução Visível','Melhorou o resultado em cinco missões.','refresh','blue',true,'Melhore em cinco missões.',34),
('melhora-10','Persistência Curió','Melhorou o resultado em dez missões.','refresh','purple',true,'Melhore em dez missões.',35),
('perfeito-1','Missão 100%','Conquistou desempenho máximo em uma missão.','check','green',true,'Alcance 100% em uma missão.',36),
('perfeito-3','Trinca 100%','Conquistou desempenho máximo em três missões.','check','green',true,'Alcance 100% em três missões.',37),
('perfeito-5','Cinco Vezes 100%','Conquistou desempenho máximo em cinco missões.','check','blue',true,'Alcance 100% em cinco missões.',38),
('perfeito-10','Dez Vezes 100%','Conquistou desempenho máximo em dez missões.','check','gold',true,'Alcance 100% em dez missões.',39),
('materias-2','Ponte entre Matérias','Explorou atividades em duas matérias diferentes.','map','blue',true,'Conclua atividades em duas matérias.',40),
('materias-3','Explorador de Três Mundos','Explorou três matérias diferentes.','map','purple',true,'Conclua atividades em três matérias.',41),
('materias-4','Quatro Caminhos','Explorou quatro matérias diferentes.','map','pink',true,'Conclua atividades em quatro matérias.',42),
('materias-5','Curioso sem Fronteiras','Explorou cinco matérias diferentes.','map','gold',true,'Conclua atividades em cinco matérias.',43),
('curso-1','Primeiro Curso Livre','Concluiu o primeiro curso livre.','book','blue',true,'Conclua um Curso Livre Curió.',44),
('curso-3','Trilha Livre','Concluiu três cursos livres.','book','purple',true,'Conclua três Cursos Livres Curió.',45),
('curso-5','Aprendiz para a Vida','Concluiu cinco cursos livres.','book','gold',true,'Conclua cinco Cursos Livres Curió.',46),
('dias-ativos-5','Cinco Dias de Estudo','Registrou atividade em cinco dias diferentes.','calendar','green',true,'Estude em cinco dias diferentes.',47),
('dias-ativos-20','Vinte Dias de Jornada','Registrou atividade em vinte dias diferentes.','calendar','blue',true,'Estude em vinte dias diferentes.',48),
('respostas-abertas-3','Explique do Seu Jeito','Escreveu três respostas abertas.','message','pink',true,'Responda três questões abertas.',49),
('respostas-abertas-10','Voz de Explorador','Escreveu dez respostas abertas.','message','purple',true,'Responda dez questões abertas.',50)
on conflict (slug) do update set
  name=excluded.name,
  description=excluded.description,
  icon=excluded.icon,
  color_key=excluded.color_key,
  active=excluded.active,
  unlock_hint=excluded.unlock_hint,
  sort_order=excluded.sort_order;

-- Compatibilidade com o slug antigo já semeado.
update public.achievements set active=false where slug='olho-de-tamandua' and exists (select 1 from public.achievements where slug='olhos-do-tamandua');

insert into public.achievement_rules (achievement_id,rule_type,threshold)
select a.id, x.rule_type, x.threshold
from (values
('calma-da-capivara','improvements',1),('voz-da-arara','open_answers',1),('imaginacao-do-boto','open_answers',3),
('pratica-do-mico','notebooks_submitted',1),('olhos-do-tamandua','distinct_subjects',2),('coragem-da-onca','improvements',3),('voo-da-harpia','reviewed_missions',10),
('primeira-descoberta','reviewed_missions',1),('trilha-de-tres','reviewed_missions',3),('cinco-passos','reviewed_missions',5),('dez-descobertas','reviewed_missions',10),('vinte-descobertas','reviewed_missions',20),('cinquenta-descobertas','reviewed_missions',50),('cem-descobertas','reviewed_missions',100),
('primeira-pagina','notebooks_submitted',1),('caderno-3','notebooks_submitted',3),('caderno-5','notebooks_submitted',5),('caderno-10','notebooks_submitted',10),('caderno-20','notebooks_submitted',20),
('sequencia-2','streak_days',2),('sequencia-3','streak_days',3),('sequencia-5','streak_days',5),('sequencia-7','streak_days',7),('sequencia-14','streak_days',14),('sequencia-30','streak_days',30),
('estrelas-10','stars',10),('estrelas-25','stars',25),('estrelas-50','stars',50),('estrelas-100','stars',100),('estrelas-250','stars',250),('estrelas-500','stars',500),
('melhora-1','improvements',1),('melhora-3','improvements',3),('melhora-5','improvements',5),('melhora-10','improvements',10),
('perfeito-1','perfect_missions',1),('perfeito-3','perfect_missions',3),('perfeito-5','perfect_missions',5),('perfeito-10','perfect_missions',10),
('materias-2','distinct_subjects',2),('materias-3','distinct_subjects',3),('materias-4','distinct_subjects',4),('materias-5','distinct_subjects',5),
('curso-1','courses_completed',1),('curso-3','courses_completed',3),('curso-5','courses_completed',5),
('dias-ativos-5','active_days',5),('dias-ativos-20','active_days',20),
('respostas-abertas-3','open_answers',3),('respostas-abertas-10','open_answers',10)
) as x(slug,rule_type,threshold)
join public.achievements a on a.slug=x.slug
on conflict (achievement_id) do update set rule_type=excluded.rule_type,threshold=excluded.threshold,updated_at=now();

create or replace function public.submit_student_notebook_assignment(p_assignment_id uuid, p_file_path text)
returns void
language plpgsql
security definer
set search_path = public, private, storage, pg_temp
as $$
declare
  v_student_id uuid;
  v_activity_id uuid;
begin
  select n.student_id,n.activity_id into v_student_id,v_activity_id
  from public.notebook_assignments n
  where n.id=p_assignment_id;

  if v_student_id is null or not exists (
    select 1 from public.students s
    where s.id=v_student_id and s.auth_user_id=auth.uid() and s.deleted_at is null
  ) then
    raise exception 'Atividade não disponível para este aluno.';
  end if;

  if not exists (
    select 1 from public.notebook_activities a
    where a.id=v_activity_id and a.status='published' and (a.publish_at is null or a.publish_at<=now())
  ) then
    raise exception 'Esta atividade ainda não está disponível.';
  end if;

  if coalesce(p_file_path,'')='' or split_part(p_file_path,'/',1) <> auth.uid()::text then
    raise exception 'Arquivo inválido.';
  end if;

  update public.notebook_assignments
  set status='submitted', submitted_at=now(), submission_photo_path=p_file_path,
      submitted_by_user_id=auth.uid(), needs_redo=false, redo_note=null,
      teacher_note=null, score=null, stars_awarded=0, updated_at=now()
  where id=p_assignment_id;
end;
$$;

revoke all on function public.submit_student_notebook_assignment(uuid,text) from public,anon;
grant execute on function public.submit_student_notebook_assignment(uuid,text) to authenticated;

create or replace function public.refresh_student_achievements(p_student_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_reviewed_missions int := 0;
  v_notebooks_submitted int := 0;
  v_streak int := 0;
  v_stars int := 0;
  v_improvements int := 0;
  v_perfect int := 0;
  v_subjects int := 0;
  v_courses int := 0;
  v_active_days int := 0;
  v_open_answers int := 0;
  v_inserted int := 0;
begin
  if v_uid is null then raise exception 'Sessão obrigatória.'; end if;
  if not (
    exists(select 1 from public.students s where s.id=p_student_id and s.auth_user_id=v_uid and s.deleted_at is null)
    or private.has_role('admin'::app_role)
    or private.teacher_has_student(p_student_id)
    or private.guardian_can_view_progress(p_student_id)
  ) then raise exception 'Sem acesso a este aluno.'; end if;

  select count(*) filter (where status='reviewed'),
         count(*) filter (where before_score is not null and after_score is not null and after_score>before_score),
         count(*) filter (where after_score>=100)
  into v_reviewed_missions,v_improvements,v_perfect
  from public.mission_students where student_id=p_student_id;

  select count(*) into v_notebooks_submitted
  from public.notebook_assignments
  where student_id=p_student_id and submitted_at is not null;

  select coalesce(streak_days,0),coalesce(stars,0) into v_streak,v_stars
  from public.student_game_profiles where student_id=p_student_id;
  v_streak := coalesce(v_streak,0); v_stars := coalesce(v_stars,0);

  select count(distinct subject_id) into v_subjects from (
    select m.subject_id from public.mission_students ms join public.missions m on m.id=ms.mission_id where ms.student_id=p_student_id and ms.status='reviewed' and m.subject_id is not null
    union all
    select a.subject_id from public.notebook_assignments na join public.notebook_activities a on a.id=na.activity_id where na.student_id=p_student_id and na.submitted_at is not null and a.subject_id is not null
  ) q;

  select count(*) into v_courses from public.free_course_enrollments where student_id=p_student_id and status='completed';

  select count(distinct day) into v_active_days from (
    select completed_at::date day from public.mission_students where student_id=p_student_id and completed_at is not null
    union all
    select submitted_at::date from public.notebook_assignments where student_id=p_student_id and submitted_at is not null
  ) d where day is not null;

  select count(*) into v_open_answers
  from public.answers ans
  join public.submissions sub on sub.id=ans.submission_id
  join public.mission_questions q on q.id=ans.question_id
  where sub.student_id=p_student_id and length(trim(coalesce(ans.answer_text,'')))>0
    and q.question_type in ('open','open_text','discursive','essay');

  with metrics(rule_type,value) as (values
    ('reviewed_missions',v_reviewed_missions),('notebooks_submitted',v_notebooks_submitted),('streak_days',v_streak),
    ('stars',v_stars),('improvements',v_improvements),('perfect_missions',v_perfect),('distinct_subjects',v_subjects),
    ('courses_completed',v_courses),('active_days',v_active_days),('open_answers',v_open_answers)
  ), ins as (
    insert into public.student_achievements(student_id,achievement_id,earned_at,source_type)
    select p_student_id,r.achievement_id,now(),'automatic'
    from public.achievement_rules r join metrics m on m.rule_type=r.rule_type
    join public.achievements a on a.id=r.achievement_id and a.active=true
    where m.value>=r.threshold
    on conflict (student_id,achievement_id) do nothing
    returning 1
  ) select count(*) into v_inserted from ins;

  return v_inserted;
end;
$$;

revoke all on function public.refresh_student_achievements(uuid) from public,anon;
grant execute on function public.refresh_student_achievements(uuid) to authenticated;

-- Dicas rotativas para o painel do aluno. Admin pode substituir/editar depois.
insert into public.daily_tips(text,active)
select text,true from (values
('Leia a pergunta até o fim antes de escolher uma resposta.'),
('Explique com suas palavras: quando você consegue explicar, aprende duas vezes.'),
('Errou? Marque a parte que confundiu você e tente de novo por outro caminho.'),
('Estudar dez minutos com atenção vale mais do que muito tempo distraído.'),
('Antes de começar, descubra qual é exatamente a tarefa.'),
('Faça uma pausa curta quando perceber que está respondendo no automático.'),
('No caderno, capriche no caminho da resposta, não só no resultado.'),
('Compare o que você pensava antes com o que entendeu depois.'),
('Se uma palavra parece difícil, procure uma pista na frase ao redor.'),
('Uma boa pergunta também é uma forma de aprender.'),
('Tente encontrar um exemplo da matéria na sua vida cotidiana.'),
('Quando terminar, revise uma resposta que você achou fácil demais.'),
('Organize os dados da questão antes de fazer a conta.'),
('Em textos, procure quem fez o quê, onde e por quê.'),
('Transforme o conteúdo em uma história curta para lembrar melhor.'),
('Use desenhos, setas ou esquemas quando uma ideia estiver confusa.'),
('Pratique primeiro sem olhar a resposta. Depois confira.'),
('Diga em voz alta o que você acabou de aprender.'),
('Separe o conteúdo grande em pequenas partes.'),
('Antes da prova, revise seus erros antigos: eles mostram onde treinar.'),
('Se travar, comece pelo que você já sabe sobre o assunto.'),
('Procure relações entre matérias diferentes. O conhecimento se conecta.'),
('Faça uma pergunta que a professora poderia colocar sobre este conteúdo.'),
('Releia a instrução antes de enviar uma atividade.'),
('Aprender também é perceber quando você precisa de ajuda.'),
('Use uma palavra nova em uma frase sua para ela fazer sentido.'),
('Em Ciências, tente prever o resultado antes de ler a explicação.'),
('Em História, pergunte o que mudou e o que continuou igual.'),
('Em Geografia, tente localizar o assunto em um mapa mental ou real.'),
('Em Matemática, confira se sua resposta combina com o tamanho esperado.'),
('Pequenos avanços repetidos viram uma grande mudança.')
) v(text)
where not exists (select 1 from public.daily_tips d where d.text=v.text);
