-- CURIÓ v1 — Taxonomia pedagógica inicial
-- Sem dados pessoais ou alunos fictícios.

insert into public.grades(name, sort_order)
values
  ('1º ano', 1),
  ('2º ano', 2),
  ('3º ano', 3),
  ('4º ano', 4),
  ('5º ano', 5),
  ('6º ano', 6),
  ('7º ano', 7),
  ('8º ano', 8),
  ('9º ano', 9)
on conflict (name) do update
set sort_order = excluded.sort_order, active = true;

insert into public.subjects(name)
values
  ('Língua Portuguesa'),
  ('Matemática'),
  ('História'),
  ('Geografia'),
  ('Ciências'),
  ('Inglês')
on conflict (name) do update set active = true;

insert into public.skills(slug, name, description)
values
  ('localizar-informacao-explicita', 'Localizar informação explícita', 'Encontrar no material informações apresentadas diretamente.'),
  ('identificar-informacao-implicita', 'Identificar informação implícita', 'Reconhecer informação que precisa ser construída a partir de pistas.'),
  ('interpretar', 'Interpretar', 'Construir sentido a partir de informações e contexto.'),
  ('inferir', 'Inferir', 'Chegar a uma conclusão sustentada por pistas ou evidências.'),
  ('reconhecer-ideia-principal', 'Reconhecer ideia principal', 'Identificar a informação central de um texto, explicação ou situação.'),
  ('identificar-intencao', 'Identificar intenção', 'Reconhecer finalidade ou intenção comunicativa.'),
  ('identificar-publico-alvo', 'Identificar público-alvo', 'Reconhecer para quem uma comunicação foi produzida.'),
  ('explicar', 'Explicar', 'Apresentar raciocínio com palavras próprias.'),
  ('justificar', 'Justificar', 'Sustentar uma resposta com razão ou evidência.'),
  ('exemplificar', 'Exemplificar', 'Produzir exemplo pertinente ao conceito.'),
  ('comparar', 'Comparar', 'Estabelecer relações entre dois ou mais elementos.'),
  ('identificar-semelhancas', 'Identificar semelhanças', 'Reconhecer características comuns.'),
  ('identificar-diferencas', 'Identificar diferenças', 'Reconhecer características que distinguem elementos.'),
  ('relacionar-informacoes', 'Relacionar informações', 'Conectar dados ou ideias relevantes.'),
  ('organizar-informacoes', 'Organizar informações', 'Estruturar dados ou ideias de forma coerente.'),
  ('organizar-cronologicamente', 'Organizar cronologicamente', 'Ordenar acontecimentos no tempo.'),
  ('causa-consequencia', 'Identificar causa e consequência', 'Reconhecer relações de causa e efeito.'),
  ('resumir', 'Resumir', 'Sintetizar mantendo ideias essenciais.'),
  ('argumentar', 'Argumentar', 'Defender uma posição com razões e evidências.'),
  ('utilizar-evidencias', 'Utilizar evidências', 'Apoiar resposta em elementos do material ou situação.'),
  ('produzir-resposta-discursiva', 'Produzir resposta discursiva', 'Responder de forma desenvolvida e autoral.'),
  ('produzir-resposta-completa', 'Produzir resposta completa', 'Atender às partes essenciais do comando.'),
  ('compreender-comandos', 'Compreender comandos', 'Interpretar corretamente o que a atividade solicita.'),
  ('aplicar-conceito', 'Aplicar conceito', 'Utilizar um conceito em questão ou situação.'),
  ('reconhecer-conceito', 'Reconhecer conceito', 'Identificar corretamente um conceito.'),
  ('memorizar-vocabulario', 'Memorizar vocabulário', 'Recordar termos relevantes ao conteúdo.'),
  ('utilizar-vocabulario', 'Utilizar vocabulário', 'Empregar termos adequados no contexto.'),
  ('produzir-frases', 'Produzir frases', 'Construir frases coerentes e adequadas ao objetivo.')
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true;
