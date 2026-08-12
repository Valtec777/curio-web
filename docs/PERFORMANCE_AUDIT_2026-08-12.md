# Auditoria de performance e escalabilidade — CURIÓ

Data: 2026-08-12  
Branch: `agent/performance-scalability`  
Base técnica: `codex/estabilizacao-curio-prioridade-1`

## Objetivo

Preparar o CURIÓ para crescer com segurança para aproximadamente:

- 100 a 500 alunos;
- 50 a 200 professores;
- 50 a 300 famílias;

sem alterar regras de negócio, fluxo financeiro, estrutura pedagógica, autenticação ou o design intencional das telas.

## Princípios usados

1. Reduzir dados transferidos antes de tentar micro-otimizar renderização.
2. Paginar listas operacionais longas no servidor/banco.
3. Fazer agregações no banco quando a interface precisa apenas de contadores.
4. Evitar `.in(...)` com listas de centenas de IDs quando o relacionamento já existe no banco.
5. Eliminar waterfalls de consultas independentes usando `Promise.all`.
6. Não criar índices duplicados: os índices existentes foram auditados antes de adicionar novos.
7. Não habilitar Cache Components/PPR globalmente sem adaptar todas as rotas autenticadas que usam cookies/sessão.
8. Manter RLS como barreira de autorização; novas RPCs usam `SECURITY INVOKER`.

---

## Gargalos confirmados e correções

### 1. Resolução de usuário autenticado

**Antes**

Após `auth.getUser()`, papéis e perfil eram consultados sequencialmente. Layout e página também podiam resolver a mesma identidade mais de uma vez no mesmo request.

**Depois**

- `getViewer()` usa `React.cache` para memoização somente dentro do request;
- papéis e perfil são consultados em paralelo com `Promise.all`;
- não existe cache persistente entre usuários.

**Impacto esperado**

Menor latência de servidor em praticamente todas as rotas autenticadas e menos consultas repetidas na mesma navegação.

---

### 2. Professor → Meus alunos

**Antes**

Uma abertura carregava todos os alunos vinculados e, para todos eles, conteúdos atuais, estados de habilidade, missões pendentes, Caderno, agenda e avatar.

Com 500 alunos, uma única resposta poderia transportar dados auxiliares de centenas de perfis.

**Depois**

- 24 alunos por página;
- consulta principal usa `range` + contagem exata;
- consultas auxiliares recebem somente os IDs da página atual;
- agenda auxiliar é filtrada aos alunos da página;
- avatar dinâmico usa `loading="lazy"` e `decoding="async"`.

**Resultado arquitetural**

O custo da rota passa a ser aproximadamente proporcional ao tamanho da página, não ao total de alunos do professor.

---

### 3. Admin → Alunos

**Antes**

A página carregava:

- todos os alunos;
- todos os professores;
- todas as famílias;
- todos os vínculos Professor↔Aluno;
- todos os vínculos Família↔Aluno;
- todas as assinaturas.

Depois, para cada aluno, executava filtros em arrays completos de vínculos, gerando custo O(N×M) em memória.

**Depois**

- 20 alunos por página;
- filtro e contagem executados no banco;
- filtro `Sem matrícula` mantém a semântica anterior: aluno sem qualquer assinatura registrada;
- vínculos e assinaturas são buscados somente para os IDs da página atual;
- vínculos são agrupados em `Map` em uma única passagem;
- totais dos cinco filtros vêm de uma única agregação no banco.

**RPCs**

- `admin_student_page(...)`;
- `admin_student_filter_counts()`.

As duas são `SECURITY INVOKER`, exigem papel admin e continuam sujeitas ao RLS normal.

---

### 4. Dashboard do Professor

**Antes**

O dashboard baixava todos os IDs de alunos ativos e reutilizava o array em várias consultas `.in(...)`. Para contar mensagens não lidas, baixava até 200 mensagens e fazia a comparação em memória.

**Depois**

A RPC `teacher_dashboard_counts()` calcula no banco:

- alunos ativos;
- correções de missão pendentes;
- Caderno enviado aguardando correção;
- missões aguardando aluno;
- avaliações dos próximos 7 dias;
- mensagens não lidas.

A função é `SECURITY INVOKER` e deriva o professor do usuário autenticado.

**Resultado arquitetural**

A interface recebe seis números, em vez de transportar listas usadas apenas para contagem.

---

### 5. Mensagens da Família

**Antes**

A página podia carregar até 300 mensagens de todas as conversas do filho para abrir uma conversa.

**Depois**

- metadados de conversas continuam limitados;
- apenas a conversa selecionada carrega mensagens completas;
- máximo de 50 mensagens por interação;
- consulta busca as mais recentes e reordena para exibição cronológica.

---

### 6. Mensagens do Professor

**Antes**

A página podia carregar até 120 threads e 600 mensagens completas de todas elas.

**Depois**

- até 80 threads;
- até 50 mensagens completas da conversa aberta;
- previews de conversas em lote limitado;
- recados administrativos em lote limitado;
- participantes consultados uma vez e indexados em `Map`.

Isso reduz memória, serialização de Server Components e transferência de dados quando o professor possui muitas conversas.

---

### 7. Agenda do Professor

**Antes**

A rota carregava até 100 compromissos e todas as respostas relacionadas. Os próximos encontros eram derivados desse mesmo histórico.

**Depois**

- histórico paginado em 30 compromissos;
- próximos 8 encontros vêm de consulta independente, ordenada por data futura;
- respostas da família são buscadas somente para a união da página atual + próximos encontros;
- a paginação do histórico não pode esconder um compromisso futuro do bloco `Próximos encontros`.

---

## Banco de dados

### Índices existentes auditados e preservados

O banco já possuía índices adequados para vários caminhos quentes, incluindo:

- agenda por professor/data;
- mensagens por thread/data;
- participantes por usuário/thread;
- missões por professor/status;
- habilidades por aluno;
- assinaturas por aluno;
- vínculos principais Professor↔Aluno e Família↔Aluno.

Eles não foram duplicados.

### Índices adicionados no PR

A migration `20260812132500_performance_hot_paths.sql` adiciona índices direcionados às consultas observadas:

- `teacher_students_active_teacher_created_idx`;
- `notebook_assignments_teacher_status_student_idx`;
- `submissions_pending_review_student_idx`;
- `assessments_teacher_upcoming_idx`;
- `support_tickets_assigned_to_user_idx`;
- `support_ticket_messages_sender_user_idx`;
- `student_occurrences_teacher_idx`.

### RLS

O advisor de performance do Supabase apontou seis policies com `auth.uid()` recalculado por linha. A migration recria as mesmas policies, com o mesmo papel `authenticated` e a mesma autorização, usando `(select auth.uid())` para permitir initplan por statement.

Policies afetadas:

- `access_events.access_self_insert`;
- `student_occurrences.occurrences_teacher_insert`;
- `support_tickets.support_tickets_self_insert`;
- `support_tickets.support_tickets_self_select`;
- `support_ticket_messages.support_messages_participant_insert`;
- `support_ticket_messages.support_messages_participant_select`.

Nenhuma regra de acesso foi ampliada.

---

## Cache, Server Components e PPR

### Implementado

- memoização por request de `getViewer()` com `React.cache`;
- paralelização de consultas independentes;
- redução de payloads e paginação antes de adicionar cache persistente.

### Deliberadamente não implementado neste PR

Cache Components/PPR global.

Motivo: o projeto possui várias rotas autenticadas que leem cookies/sessão. Ativar PPR global sem envolver corretamente esses acessos em boundaries de `Suspense`/componentes dinâmicos aumentaria risco de regressão e mudaria muitas rotas ao mesmo tempo. Esse trabalho deve ser uma etapa separada após medir as rotas que realmente se beneficiariam.

---

## Assets

No diretório de alunos, avatares dinâmicos receberam lazy loading e decode assíncrono. Não foi feita migração em massa de URLs dinâmicas para `next/image` porque os caminhos vêm de assets configuráveis/Storage e a política de hosts/loader deve ser auditada antes para evitar imagens quebradas.

---

## Gargalo confirmado ainda não alterado

### Admin → Documentos / contratos

A tela atual gera URL assinada de contrato dentro de um `for ... await`, uma por vez. Se houver muitos contratos com arquivo, isso cria um waterfall de chamadas ao Storage.

Também existem lotes de até 120 contratos, 120 eventos jurídicos e 120 documentos operacionais na mesma abertura.

**Próxima otimização recomendada**

1. Paginar contratos/documentos/evidências por seção;
2. usar geração em lote de URLs assinadas (`createSignedUrls`) quando compatível com a versão do SDK/Storage;
3. ou gerar URL assinada sob demanda ao clicar em `Abrir contrato`, eliminando a necessidade de assinar arquivos que o admin não abriu.

Não foi alterado neste PR porque a tela é extensa e mistura operações jurídicas; a mudança merece um PR pequeno próprio para reduzir risco de regressão.

---

## Cenários de escala esperados

### ~100 alunos

- diretórios carregam apenas 20/24 registros;
- dashboard recebe agregados;
- mensagens limitadas por conversa;
- agenda limitada por página.

Não há necessidade de transportar dados de todos os 100 alunos em uma navegação normal.

### ~500 alunos

- custo das listas continua limitado ao page size;
- joins/agregações permanecem no Postgres, onde existem índices e planner;
- evita arrays `.in(...)` de centenas de IDs nas rotas principais auditadas.

### 50–200 professores

- dados de cada professor continuam escopados pelo vínculo/RLS;
- índices usam `teacher_id` nos principais caminhos;
- painel do professor não depende do número total de professores do sistema.

### 50–300 famílias

- conversas familiares carregam somente uma thread e até 50 mensagens;
- vínculo Família↔Aluno permanece a fonte de autorização;
- crescimento de outras famílias não amplia o payload normal de uma família autenticada.

---

## Checklist de validação

### Automatizado

- [x] `npm ci`;
- [x] `npm run typecheck`;
- [x] `npm run build`;
- [x] CI habilitado também para PR técnico empilhado;
- [x] policies originais comparadas no banco antes da reescrita;
- [x] índices existentes auditados antes de criar novos.

### Antes de aplicar as migrations em produção

- [ ] aplicar migrations em ambiente de preview/dev Supabase ou janela controlada;
- [ ] executar `get_advisors` de performance e segurança após DDL;
- [ ] validar `teacher_dashboard_counts()` com professor real;
- [ ] validar `admin_student_page()` nos cinco filtros;
- [ ] validar RLS de suporte para autor, responsável atribuído e usuário sem vínculo;
- [ ] conferir planos com `EXPLAIN (ANALYZE, BUFFERS)` quando houver volume representativo.

### Teste visual/autenticado

- [ ] Professor → Hoje;
- [ ] Professor → Meus alunos, páginas 1/2 e último item;
- [ ] Professor → Mensagens com thread longa;
- [ ] Professor → Agenda com mais de 30 eventos;
- [ ] Família → Mensagens com thread longa;
- [ ] Admin → Alunos, todos os filtros e paginação;
- [ ] validar navegação no celular/tablet em conjunto com o PR de responsividade.

---

## Estado atual

- mudanças isoladas no PR de performance;
- `main` não alterada;
- migrations deste PR não aplicadas em produção;
- GitHub Actions passa com typecheck e build;
- não houve Preview Vercel novo para esta branch durante a auditoria, portanto build aprovado não deve ser confundido com teste visual/runtime autenticado.

## Resumo

As correções priorizaram os pontos em que o custo crescia diretamente com o número total de alunos, vínculos ou mensagens. O resultado remove cargas globais das rotas mais críticas do Professor, Família e Admin e transforma os principais diretórios e históricos em consultas de tamanho limitado.

O próximo ganho de alta confiança é isolar e otimizar a tela administrativa de Documentos/contratos; depois disso, medições reais de latência e planos de consulta com volume representativo devem decidir se vale avançar para cache persistente/PPR por rota.
