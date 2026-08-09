# CURIÓ — Handoff técnico, funcional e de conteúdo
Data: 09/08/2026
Projeto Supabase: `curio-app` (`ghpqnqxjxmdmhikdacoq`)
Aplicação: Next.js 16 / Supabase

Este arquivo existe para que o projeto não dependa da memória da conversa. Ele registra o que foi definido, construído, testado e o que ainda está pendente.

---

## 1. Identidade e posicionamento

Texto principal atual:

**Acompanhamento escolar que descobre como seu filho aprende.**
Para crianças do **1º ao 8º ano**.

Missões personalizadas, atividades no caderno e acompanhamento humano para transformar dificuldade em evolução visível.

**Tecnologia ajuda. Seu cérebro resolve.**

Experiências centrais:
- Missão Cuca;
- Caderno Curió;
- Modo Pensar;
- Meu Caminho;
- Modo Prova.

Fonte de identidade escolhida: **Fredoka**.
Fonte de leitura/operação: **Nunito Sans**.

Cores-base: navy, azul, rosa, roxo, lima, amarelo e creme.

---

## 2. Personagens oficiais

Universo Curió já modelado com:
- Capivara — calma;
- Boto-cor-de-rosa — imaginação;
- Arara-azul — comunicação;
- Mico-leão-dourado — prática;
- Tamanduá-bandeira — investigação;
- Onça-pintada — coragem;
- Harpia — conquista especial.

Os personagens ficam em `characters` e podem ter assets principal/avatar/sticker/poses.

---

## 3. Portais e rotas funcionais

### Professor
Hoje, Agenda, Alunos, Turmas, Mapa Pedagógico, Grupos Pedagógicos, Missões, Materiais, Gerador, Conteúdos, Correções, Avaliações, Mensagens, Relatórios, Suporte, Perfil e Área Administrativa quando o mesmo usuário também for admin.

### Aluno
Hoje, Missões, Agenda, Caminho, Perfil, Meu Caderno, Conquistas, Descobertas, Modo Pensar e Modo Prova.

### Família
Visão geral, Meu filho/Meus filhos, Conteúdos, Atividades, Progresso, Avaliações, Agenda, Mensagens, Relatórios, Plano, Contrato, Pagamentos, Suporte, Perfil e Configurações.

### Admin
Hoje, Matrículas, Usuários e acessos, Alunos, Famílias, Professores, Vínculos, Turmas, Relatórios Acadêmicos, Ocorrências, Conteúdo, Galeria de Materiais, Configuração de Notas, Séries, Gerador, Modelos, Calendário Escolar, Financeiro, Planos, Mensagens, Suporte e Tickets, Documentos, Comunicação, Listas, Gestão de Mascotes, Biblioteca de Mídia, Auditoria, Monitoramento de Acesso, Lixeira e Configurações.

---

## 4. Acesso institucional

Cadastro público de Família não deve existir.

Fluxo definido:
1. Admin faz a matrícula/cadastro.
2. Admin informa e-mail do responsável/professor/admin.
3. Sistema envia primeiro acesso.
4. Usuário define a própria senha.
5. Login normal pelo portal.
6. “Esqueci minha senha” disponível para Admin, Professor e Família.

Foi criada Edge Function protegida `curio-access-admin` para convites e reenvio de acesso.

Existe tabela `access_invitations` e fluxo de primeiro acesso/recuperação no frontend.

Situação atual: a conta interna `wanelle52@gmail.com` possui os papéis `admin`, `teacher`, `student` e `guardian`, com perfis técnicos necessários para abrir os quatro ambientes. A senha não é armazenada em código ou documentação.

---

## 5. Mapa Pedagógico 360º

Princípio: não reduzir aprendizagem a uma nota e não diagnosticar a matéria inteira por dificuldade pontual.

Estrutura:
- conteúdo;
- habilidade;
- evidência;
- domínio 0–4;
- autonomia;
- confiança;
- facilidade/dificuldade;
- tendência/evolução;
- prioridade;
- próxima intervenção;
- revisão do professor;
- histórico.

Taxonomia canônica de habilidades com 28 skills iniciais.

Estado incremental em `student_skill_states`, histórico em `student_skill_state_history`, evidências em `pedagogical_evidence`.

Confiança atual:
- até 2 evidências: baixa;
- 5+ e consistência alta: alta;
- demais casos: média.

Tendência considera blocos recentes e pode resultar em improving, attention, stable ou oscillating.

Override da professora é auditável e preserva o valor automático para comparação.

---

## 6. R.E.E.

Tabela `answer_ree_assessments` separa:
- resposta;
- explicação;
- evidência;
- organização;
- correção do conteúdo.

A avaliação de R.E.E. não deve transformar “conteúdo correto, mas sem explicação/evidência” em domínio pleno.

---

## 7. Turmas e grupos

`classes`, `class_students`, `class_teachers` representam vínculos oficiais.

Grupos pedagógicos são independentes da matrícula:
- `pedagogical_groups`;
- `pedagogical_group_students`;
- `pedagogical_group_skills`.

Há RPC para atribuição de missão a grupo em lote.

---

## 8. Operação/Admin

Estruturas adicionadas ou consolidadas:
- agenda/calendário;
- materiais;
- mensagens;
- planos, assinaturas, contratos e pagamentos;
- matrículas/leads;
- personagens;
- modelos de conteúdo;
- fila de geração;
- listas;
- documentos;
- comunicação;
- relatórios;
- lixeira;
- ocorrências;
- auditoria;
- monitoramento de acesso;
- suporte/tickets;
- mídia central;
- configuração de notas.

Auditoria deve ser somente leitura para Admin. Não editar/apagar histórico operacional pela interface normal.

---

## 9. DOCS CURIO como fonte de verdade

A pasta `DOCS CURIO` no Drive contém modelos visuais. Foram lidos e cadastrados como contratos oficiais no Supabase:
- ATV-01 — Missão Cuca;
- PED-01 — Diagnóstico Inicial;
- PED-02 — Ficha Individual do Aluno;
- PED-03 — Registro Pós-Encontro;
- PRO-01 — Plano de Aprendizagem 30 Dias;
- REL-01 — Relatório Mensal da Família;
- FAM-01 — Questionário Inicial da Família;
- ADM-01 — Checklist de Matrícula;
- ADM-02 — Ficha de Matrícula Operacional;
- OPS-01 — Fluxo Operacional do Aluno Piloto.

Arquivo real de aluno não foi usado como template para evitar copiar dados pessoais.

### Contrato da Missão Cuca
Sequência oficial:
1. Objetivo da missão;
2. Primeiro, vamos entender;
3. Explicação curta;
4. Exemplo;
5. Agora é sua vez;
6. Pista sem entregar resposta;
7. Agora é no Caderno Curió;
8. Explique com suas palavras.

Regra do Manual do Professor: IA prepara rascunho; professor revisa e aprova; nunca publicar diretamente.

### Caderno Curió
Ainda não existe um documento visual standalone específico de Caderno Curió na pasta `DOCS CURIO`. O Caderno aparece como etapa obrigatória/complementar da Missão e em registros operacionais. Quando houver um modelo próprio, sugerido código: `ATV-02 — Caderno Curió`.

---

## 10. Gerador do Professor

Frontend preparado para receber:
- texto/prompt;
- PDF;
- TXT;
- DOCX;
- aluno opcional;
- ano escolar;
- matéria;
- intenção/título;
- tipo de saída.

Saídas previstas:
- Missão Cuca;
- atividade do Caderno Curió;
- Modo Prova;
- Diagnóstico Inicial;
- Plano 30 Dias;
- Registro Pós-Encontro;
- Relatório da Família.

Buckets privados:
- `generation-sources` — até 10 MB;
- `generated-documents` — até 20 MB.

A fila usa `generation_jobs` e registra `template_contract`, origem, arquivo, revisão humana obrigatória e `auto_publish=false`.

**Limitação atual importante:** o pipeline de entrada e fila está pronto, mas não há provedor de IA configurado no ambiente para transformar automaticamente o conteúdo em rascunho final. Não fingir que a geração está concluída enquanto essa integração não existir.

---

## 11. Aparência e acessibilidade

Central global implementada para site público e portais:
- Claro;
- Escuro;
- Seguir sistema;
- Apoio visual;
- Segurança para epilepsia;
- Foco cognitivo/TDAH;
- Som ligado/desligado.

Preferências são locais ao dispositivo.

Modo de segurança para epilepsia:
- desativa animações e transições;
- remove gradientes/movimentos principais;
- pausa vídeos encontrados;
- respeita `prefers-reduced-motion`.

Não apresentar como garantia médica.

Modo de foco:
- remove elementos decorativos secundários;
- evita movimentos no hover;
- simplifica fundos;
- prioriza conteúdo essencial.

---

## 12. Som

Sistema de som curto via Web Audio API, sem arquivos externos:
- `correct`;
- `incorrect`;
- `mission-complete`.

Som vem desligado por padrão.

Missão enviada/concluída no Portal do Aluno pode disparar som de conclusão quando ativado.

Acerto/erro será ligado às respostas objetivas quando a correção automática estiver conectada ao fluxo da Missão.

Futuro: substituir tons sintetizados por assets sonoros próprios da marca.

---

## 13. Hero em vídeo — ideia registrada, não implementada

Quando houver direção de arte/IA/desenhista:
- criar loop curto 5–10s;
- MP4 + WebM;
- poster estático;
- mascotes em movimento suave;
- sem flash;
- sem autoplay no modo epilepsia/reduced-motion;
- não esconder informação importante dentro do vídeo.

---

## 14. Banco e migrações principais aplicadas

Conjuntos principais já aplicados no Supabase:
- expansão inicial de gamificação/caderno/avaliações;
- hardening de segurança;
- `pedagogical_map_360_core`;
- `pedagogical_map_360_security_and_engine`;
- `pedagogical_map_360_workflows`;
- `quizzes_and_assessment_evidence_sources`;
- `portal_operations_core`;
- `portal_rls_hardening`;
- `pedagogical_and_portal_performance_indexes`;
- módulos administrativos/ocorrência/auditoria/suporte/mídia/notas;
- acesso institucional;
- permissão Admin para editar perfis;
- `generator_sources_and_curio_templates`.
- `family_student_pin_and_guardian_student_actions`;
- `guardian_student_submission_read_fix`;
- `courses_legal_and_access_management`;
- `mission_quiz_question_types`;
- `ai_specialist_scaffold`;
- `fix_ai_student_context_columns`.

---

## 15. Testes pedagógicos executados

Testes transacionais com rollback confirmaram:
- tag pedagógica mantém questões/habilidades diferentes;
- habilidades diferentes não transformam a matéria inteira em dificuldade;
- evidência insuficiente retorna baixa confiança/diagnóstico insuficiente;
- evolução produz tendência improving quando sustentada;
- R.E.E. separa conteúdo correto de explicação/evidência ausentes;
- conteúdo atual pode ser sugerido como inferência, não confirmação;
- atribuição de grupo funciona em lote;
- visão agregada de turma retorna os alunos vinculados;
- override da professora é auditável e preserva cálculo automático.

Dados sintéticos foram revertidos e não permaneceram no banco.

**Teste 14 / intervenção automática completa ainda não foi finalizado.** Existe estrutura de intervenções, mas falta o mecanismo automático que evite repetição e sugira a próxima ação com aprovação da professora.

---

## 16. Segurança e limitações conhecidas

Avisos conhecidos do Supabase:
- extensão `citext` no schema público;
- RPCs `SECURITY DEFINER` protegidos, executáveis por authenticated e com checagem interna de permissão;
- proteção contra senhas vazadas precisa ser habilitada na configuração do Auth.

Alguns avisos de performance sobre FKs/políticas permissivas ainda são informativos e devem ser revisados conforme o volume real crescer.

O Admin pode editar operação e cadastros, mas logs de auditoria/acesso devem permanecer imutáveis.

---

## 17. Próximas prioridades recomendadas

1. Validar end-to-end os quatro ambientes usando a conta interna multirrole e depois manter contas reais com apenas os papéis necessários.
2. Ligar um provedor de IA ao `generation_jobs` para transformar fontes em rascunhos usando contratos `content_templates`.
3. Criar `ATV-02 — Caderno Curió` como modelo visual standalone.
4. Implementar intervenção automática com aprovação da professora e prevenção de repetição.
5. Fechar upload/correção de fotos do Caderno Curió.
6. Ligar sons de acerto/erro ao motor de questões objetivas.
7. Substituir ícones genéricos pelo kit próprio listado em `ASSET_GENERATION_CHECKLIST.md`.
8. Produzir assets de hero em vídeo quando houver material oficial.
9. Fazer validação visual/end-to-end em desktop e celular.
10. Deploy público em hospedagem (ex.: Vercel) com variáveis de ambiente e URLs de Auth configuradas.

---

## 18. Regra de proteção do projeto

Nunca colocar em documentação pública:
- service role key;
- senhas;
- tokens;
- dados pessoais de alunos/famílias;
- conteúdo privado de mensagens.

O `.env.local` deve continuar fora de pacotes compartilhados e repositórios públicos.

---

## 19. Refinamento da página pública e acesso Admin — 09/08/2026

Acesso:
- o usuário interno `wanelle52@gmail.com` passou a ter os quatro papéis de validação (`admin`, `teacher`, `student`, `guardian`);
- o `/dashboard` deve permitir escolher entre Administração, Professor, Aluno e Ninho da Família;
- entrada normal: `/login` → autenticação → `/dashboard` → Administração;
- se a senha não for conhecida, usar o fluxo de recuperação de senha; não criar senha fixa em código ou documentação.

Página pública:
- Fredoka passa a ser efetivamente usada em títulos, botões e chamadas; Nunito Sans em leitura e operação;
- hero principal ganhou tipografia maior e destaques azul/rosa;
- azul/rosa/lima/amarelo foram intensificados para se aproximar da identidade original do Curió, mantendo a linguagem de app educacional;
- faixa “Tecnologia ajuda. Seu cérebro resolve.” usa azul Curió mais vivo;
- CTA secundário do hero passa a usar rosa;
- mascotes do hero deixam de ficar dentro de um card visual;
- seção “Seis formas de aprender” remove caixas e fundos atrás das imagens PNG, preservando a transparência original;
- nomes dos animais viram pills coloridas e os traços pedagógicos usam a mesma família de cor: verde, rosa, azul ou amarelo;
- descrições atuais: Capivara — Calma e organização; Boto — Imaginação e criatividade; Arara — Comunicação e expressão; Mico — Prática e persistência; Tamanduá — Investigação e atenção; Onça — Coragem e confiança;
- FAQ foi trocado por acordeão controlado: somente uma resposta fica aberta de cada vez; ao abrir outra, a anterior fecha.

Arquivos principais:
- `app/page.tsx`;
- `app/globals.css`;
- `components/faq-accordion.tsx`.


---

## 20. Conta interna multirrole, planos e gestão segura — 09/08/2026

### Conta interna de validação
- `wanelle52@gmail.com` possui `admin`, `teacher`, `student` e `guardian`;
- existe perfil de professora ativo ligado ao mesmo usuário;
- existe um aluno técnico de teste chamado **Ellen — acesso interno de teste**, ligado ao mesmo `auth_user_id`;
- o perfil de família e o perfil de professora estão vinculados ao aluno técnico para permitir testar o ciclo completo;
- vínculos anteriores existentes não foram removidos;
- a conta deve ser tratada como conta interna de validação, não como modelo de permissões para famílias/professores reais.

### Planos comerciais oficiais atuais
1. **CURIÓ Essencial** — R$ 249/mês — 4 encontros — Online — ativo — visível na landing — disponível para matrícula.
2. **Plano Piloto CURIÓ** — R$ 180/mês — 4 encontros — Online — ativo — selo Piloto — disponível para matrícula — não exibido na landing por padrão.
3. **CURIÓ Acompanhamento** — R$ 399/mês — 8 encontros — Online — ativo — selo Recomendado — visível na landing — disponível para matrícula.

Planos antigos **CURIÓ Acompanhamento — Lançamento (R$349)** e **CURIÓ com Educador (R$549)** foram arquivados/inativados e não fazem parte do catálogo comercial oficial atual.

O Admin pode criar e editar nome, descrição, preço, quantidade de encontros, modalidade, selo, visibilidade na landing, disponibilidade para matrícula e estado do plano. Também pode colocar em rascunho, arquivar e excluir. Quando houver assinatura vinculada, a exclusão deve virar arquivamento para preservar histórico financeiro.

A landing passou a consultar `plans` e exibir somente planos `active=true`, `visible_on_landing=true`, `archived_at is null` e `deleted_at is null`, ordenados por `sort_order`.

Limitação de hardening conhecida: a política pública antiga de `plans` ainda é mais ampla (`active=true`) porque o conector bloqueou a alteração de política durante esta sessão. A UI pública filtra corretamente a visibilidade, mas a RLS deve ser endurecida em uma etapa futura para espelhar `visible_on_landing`.

### Editar, arquivar e excluir
- **Mensagens:** Admin edita/remove qualquer mensagem; professora edita/remove somente o que enviou. Remoção é lógica (`deleted_at`) para preservar histórico da conversa.
- **Missões:** professora pode editar e arquivar. Rascunho sem atribuição pode ser excluído fisicamente; missão já atribuída/publicada deve ser arquivada para preservar respostas/evidências.
- **Materiais, Caderno e Avaliações:** editar e alternar entre rascunho/publicado/arquivado; exclusão física somente para rascunho sem atribuições. Caso contrário, arquivar.
- **Planos:** exclusão sem assinatura pode ir para Lixeira; com assinatura, arquivar.
- **Auditoria e Monitoramento de Acesso:** continuam imutáveis por design.

Admin ganhou a seção **Missões e atividades** para administrar Missões Cuca, Caderno Curió, materiais e avaliações em um lugar só.

### Som e acessibilidade
- opção de som aparece somente nas rotas `/aluno`;
- a página pública continua com tema/acessibilidade, mas não mostra controle de efeitos sonoros;
- sons permanecem desligados por padrão;
- modo de segurança para epilepsia recebeu contraste explícito: fundos e textos de blocos escuros/claros não podem ficar com branco sobre branco após a remoção de gradientes;
- botões principais viram cores sólidas seguras nesse modo e animações/transições permanecem desativadas;
- layout operacional recebeu sombras mais leves, fundos mais neutros e menos efeitos de hover para reduzir fadiga visual.

### Arquivos desta etapa
- `app/admin/actions.ts`;
- `app/admin/[section]/page.tsx`;
- `app/message-actions.ts`;
- `app/professor/manage-actions.ts`;
- `app/professor/[section]/page.tsx`;
- `app/professor/missoes/actions.ts`;
- `app/professor/missoes/page.tsx`;
- `app/page.tsx`;
- `app/globals.css`;
- `components/experience-preferences.tsx`;
- `components/app-shell.tsx`;
- `supabase/migrations/009_commercial_plans_and_content_management.sql`.

---

## 21. Espaço da criança via Família, PIN, navegação ativa e identidade de e-mail — 09/08/2026

### Fluxo Família → Aluno
- produção não depende de e-mail próprio para a criança;
- o responsável entra com o e-mail liberado pela matrícula;
- no Ninho da Família aparece **Espaço da criança / Quem vai estudar agora?** para cada aluno vinculado;
- ao escolher uma criança, o sistema cria contexto HTTP-only de aluno com duração operacional de até 6 horas e abre `/aluno`;
- todas as páginas do Aluno usam o aluno selecionado e validam que ele realmente está vinculado ao responsável;
- a conta interna multirrole continua podendo testar um aluno próprio, mas isso não é o modelo de produção.

### PIN de 4 números do Ninho da Família
- no primeiro acesso da Família, se ainda não existir PIN, a interface exige a criação de um PIN de exatamente 4 dígitos;
- PIN é armazenado somente como hash em `guardian_portal_pins`; não guardar PIN em texto puro em código, logs ou documentação;
- depois de 5 tentativas inválidas, o retorno à Família fica bloqueado por 5 minutos;
- quando existe contexto de criança, `/dashboard`, `/familia`, `/admin` e `/professor` são redirecionados para `/aluno/desbloquear-familia`;
- o menu do Aluno mostra **Voltar à família** e exige PIN antes de limpar o contexto da criança;
- sair completamente da conta continua permitido e limpa o contexto de aluno;
- o PIN protege a troca de ambiente no aparelho; não substitui a senha de autenticação do responsável.

### RLS para sessão do responsável no espaço da criança
- guardian vinculado pode ler Missões atribuídas ao estudante correto;
- guardian vinculado pode criar/ler submissões e criar/ler respostas quando está atuando no espaço da criança;
- foi corrigida a política de leitura de Missões que comparava erroneamente `mission_id` com o próprio id da atribuição;
- a relação guardian → student continua sendo a fonte de autorização no banco.

### Navegação e ícones
- substituídos emojis/símbolos básicos da sidebar por SVGs lineares próprios em `components/nav-icon.tsx`, seguindo a referência visual enviada: traço fino, cinza e sem quadradinhos coloridos atrás do ícone;
- `components/nav-link.tsx` usa a rota atual para aplicar `aria-current="page"` e classe `is-active`;
- hover fica mais claro;
- rota selecionada permanece mais escura, com texto mais forte e pequeno marcador lateral azul;
- tema escuro possui equivalentes de hover/ativo com contraste suficiente.

### Erro do Gerador corrigido
- removido `encType="multipart/form-data"` do `<form action={queueCurioGeneration}>`;
- quando `action` é Server Action, React/Next define `method` e `encType` automaticamente;
- o formulário continua aceitando PDF/TXT/DOCX via `FormData`.

### Som e contraste
- som permanece disponível somente dentro do espaço real do Aluno, não na landing, Família, Professor, Admin nem na tela de PIN;
- o detector usa a rota atual para também funcionar após navegação client-side;
- modo de segurança para epilepsia recebeu regras extras para cards/painéis claros nunca herdarem texto branco em fundo branco.

### E-mail e domínio
- modelos visuais preparados em `supabase/templates/invite.html` e `supabase/templates/recovery.html`;
- assuntos recomendados: **Seu acesso ao CURIÓ está pronto** e **Redefina sua senha do CURIÓ**;
- em produção, configurar Email Templates no Supabase hospedado e SMTP próprio com domínio verificado para o remetente aparecer como CURIÓ;
- documentação operacional: `docs/EMAIL_DOMAIN_SETUP.md`;
- domínio público do frontend deve apontar para a hospedagem Next.js (planejado: Vercel); Custom Domain do Supabase é opcional e separado do domínio público do site.

### Migrações desta etapa
- `010_family_student_pin.sql`;
- `011_guardian_student_submission_read_fix.sql`.

Complemento da conta multirrole: quando um usuário possui simultaneamente `guardian` e `student`, o cartão **Modo Criança** do `/dashboard` leva à seleção de criança em `/familia/filhos`. O helper de aluno não aceita fallback direto para o perfil `student` quando também existe papel `guardian`; é obrigatório entrar pelo contexto de criança criado pelo Ninho da Família. Isso mantém a exigência do PIN também na conta interna de teste.


---

## 22. Finalização funcional — Missões, Cursos Livres, documentos e gestão — 09/08/2026

### Missões do Aluno
- criada rota real `/aluno/missoes`; o 404 ocorria porque antes existia somente `/aluno/missoes/[id]`;
- a lista agora separa para fazer, aguardando correção e corrigidas;
- Missão Cuca é explicitamente uma atividade interativa dentro do sistema;
- Meu Caderno continua separado para atividades fora da tela/impressas.

### Missão como quiz
- `mission_questions` passou a aceitar `options` para questões objetivas;
- tipos preparados na criação: discursiva, múltipla escolha e verdadeiro/falso;
- gabaritos ficam em `mission_question_answer_keys`, tabela separada e protegida por RLS;
- aluno/família comum não recebe o gabarito; professora criadora e Admin podem acessar para correção;
- conta multirrole interna continua tendo privilégios de Admin por definição e não deve ser usada como conta real de criança/família.

### Cursos Livres / Modo Pensar
- Modo Pensar passa a ser o catálogo de Cursos Livres do CURIÓ;
- Admin cria curso, etapas, ordem, conteúdo, duração, links/arquivos e escolhe se emite certificado;
- somente cursos publicados aparecem para aluno;
- aluno inicia, marca etapas obrigatórias e acompanha percentual;
- conclusão de todas as etapas obrigatórias gera certificado com código único;
- fluxo de curso/certificado foi testado em transação e revertido após validação.

### Documentos jurídicos
- criada estrutura `legal_documents` com versões, rascunho/publicado/arquivado, versão atual e arquivo/texto;
- somente versão publicada e atual pode aparecer ao público;
- editar documento já publicado deve ser feito criando nova versão, preservando a anterior;
- catálogo jurídico informado foi cadastrado no banco. Conteúdos/arquivos reais precisam ser vinculados quando estiverem disponíveis no Drive/Supabase Storage.

### Gestão de pessoas
- Admin pode editar dados de alunos, professores e famílias;
- pode retirar/reativar acesso operacional sem destruir o histórico;
- papéis Admin/Professor/Família podem ser concedidos ou removidos em Usuários e acessos;
- sistema protege contra remover o próprio Admin pelo botão e contra ficar sem nenhum Admin;
- exclusão física de pessoa com histórico pedagógico/financeiro não deve ser usada como ação comum. Desativar/arquivar preserva evidências, contratos e auditoria.

### Correções de interface
- componente `Badge` corrigido e fechado corretamente;
- “Trocar ambiente” voltou a aparecer em Admin/Professor/Família e continua protegido por PIN no fluxo Aluno → Família;
- layout recebeu espaçamento e cartões mais leves para reduzir fadiga visual.

### E-mail oficial
Contato institucional atual no site: **curio.educacao@gmail.com**.

---

## 23. SEO, GEO e descoberta pública — 09/08/2026

Preparado no Next.js:
- metadata com título, description, canonical, Open Graph e Twitter Card;
- conteúdo e termos coerentes com acompanhamento escolar, aprendizagem personalizada, preparação para provas e cursos livres;
- JSON-LD `EducationalOrganization`, `Service` e `FAQPage` na landing;
- `app/robots.ts` permitindo páginas públicas e bloqueando portais internos;
- `app/sitemap.ts` para URLs públicas principais;
- metadata `noindex` nos layouts Admin, Professor, Aluno e Família;
- `public/llms.txt` como arquivo informativo experimental para agentes que optarem por consultá-lo.

Importante: SEO/GEO aumenta clareza e descoberta, mas não garante posição no Google nem recomendação por sistemas de IA. Após o deploy público, cadastrar o site no Google Search Console e enviar `/sitemap.xml`.

A frase “Os planos podem ser ajustados pela administração sem precisar refazer a landing page.” foi removida da seção pública de planos.

---

## 24. IA Especialista de Professor/Admin — estrutura preparada

Foi criada base para uma IA interna futura:
- `ai_assistant_threads`;
- `ai_assistant_messages`;
- `ai_assistant_actions`;
- RPC protegida `build_ai_student_context(student_id)`.

A função de contexto entrega somente contexto pedagógico mínimo: série, conteúdos atuais, skill states, domínio, autonomia, confiança, tendência, evidências recentes, missões e intervenções. Ela não inclui automaticamente mensagens privadas da família, financeiro, contratos, PIN, senha ou chaves.

Permissão:
- Admin pode consultar contexto autorizado;
- Professor somente aluno vinculado;
- Família/Aluno não acessam a IA especialista interna.

Regra: IA sugere; pessoa aprova. Nenhuma sugestão deve publicar missão, mudar mapa pedagógico ou alterar cadastro automaticamente sem confirmação humana.

A camada de segurança/contexto está pronta e foi testada. **Ainda falta escolher/configurar um provedor de IA e implementar o worker/interface conversacional que gera respostas.**
