# CURIÓ — Estado de prontidão em 2026-08-11

Este documento separa o que já está concluído tecnicamente do que ainda depende de teste visual autenticado, decisão comercial, revisão jurídica, configuração externa ou escolha da marca definitiva.

## Concluído tecnicamente sem depender da marca

### Matrícula, acesso e consistência
- matrícula administrativa idempotente e edição preservando IDs;
- vínculos Professor↔Aluno e Família↔Aluno protegidos contra duplicidade;
- apenas uma assinatura corrente por aluno;
- solicitações públicas protegidas contra repetição equivalente;
- auditoria atual sem grupos duplicados de idempotência/vínculos/assinaturas correntes;
- aluno na Lixeira deixa de ter acesso operacional por Professor/Família;
- convites `pending/sent` passam automaticamente para `cancelled` quando o aluno vai para a Lixeira, preservando o histórico;
- restauração continua preservando IDs e histórico em vez de recriar entidades.

### Agenda, mensagens e notificações internas
- Agenda Professor → Aluno → Família reutiliza `agenda_events` e `agenda_event_students`;
- criação idempotente e validação do vínculo do Professor com o Aluno;
- avisos internos para família são enviados ao criar encontro visível à família;
- confirmação e cancelamento de encontro também geram aviso interno;
- atribuição de missão gera aviso interno para família vinculada, com prazo quando existir;
- avisos usam `request_key` idempotente e não duplicam conversa em retry;
- falha de mensagem não desfaz agenda/missão já salva;
- mensagens continuam no sistema existente (`message_threads`, participantes e mensagens), sem canal paralelo.

### Família e confiança
- Ninho da Família possui visão objetiva de progresso baseada em dados reais;
- resumo mostra força atual, prioridade e próximo passo sem gerar diagnóstico automático;
- pagamentos por comprovante validam vínculo da família, tipo/tamanho do arquivo e impedem pendência duplicada;
- Admin confere comprovante antes de marcar pagamento como pago;
- Home do Admin destaca novos interesses, matrículas, contratos aguardando assinatura e comprovantes aguardando conferência;
- Admin → Documentos exibe contratos por aluno/responsável/plano e permite abrir arquivo quando disponível.

### Jurídico e privacidade — infraestrutura técnica
- 10 documentos jurídicos/modelos atuais existem em `legal_documents` e permanecem em `draft` até revisão humana;
- versões publicadas não são sobrescritas; nova alteração exige nova revisão/versão;
- criado histórico append-only de evidências jurídicas em `legal_acceptance_events`;
- evidência registra documento, versão, usuário autenticado, responsável, criança quando aplicável e horário do servidor;
- Termos registram `accepted` (concordância);
- Política de Privacidade registra `acknowledged` (ciência), sem tratá-la como consentimento genérico;
- consentimento específico e autorização de imagem/voz/produções são separados por criança e permitem autorizar, não autorizar e revogar;
- RLS restringe leitura ao próprio usuário ou Admin e impede UPDATE/DELETE do histórico pelo usuário;
- Ninho da Família ganhou `/familia/privacidade`;
- Admin → Documentos exibe evidências por versão;
- quando uma nova versão publicada de Termos/Privacidade ainda não tiver o registro adequado, a Família recebe aviso para revisar.

### Cursos e certificados
- estrutura de cursos, módulos, progresso e conclusão já existe;
- conclusão de todos os módulos obrigatórios pode emitir certificado com código único;
- criada validação pública por código com exposição mínima de dados;
- certificado do aluno ganhou link de validação e botão `Imprimir / salvar em PDF`;
- texto deixa explícito que certificado de curso livre não equivale automaticamente a diploma escolar/técnico/profissional regulamentado.

### Experiência do aluno
- avatar por personagem persiste no perfil;
- `Momento Curió` reage a estrelas, sequência e missões pendentes e oferece dicas de estudo;
- envio de missão ganhou celebração curta com mascote focada em esforço/processo, não apenas pontos;
- experiência mantém opção de movimento reduzido e camada de acessibilidade existente.

### Segurança
- tabelas expostas auditadas permanecem com RLS;
- RPCs `SECURITY DEFINER` sensíveis foram revisadas por escopo; as funções inspecionadas verificam papel, identidade e/ou vínculo internamente;
- não houve remoção em massa de RPCs legítimas apenas para silenciar advisor;
- PIN da Família permanece sem acesso direto e com bloqueio de tentativas via RPC;
- links de recuperação priorizam `NEXT_PUBLIC_SITE_URL`/URL Vercel confiável e não usam `Origin` arbitrário como fonte principal;
- criação/redefinição de senha pelo site exige pelo menos 10 caracteres, maiúscula, minúscula, número e símbolo;
- baseline de headers de segurança continua ativo;
- validação de certificado é pública por desenho, exige código exato de alta entropia e devolve somente dados mínimos.

### Qualidade
- workflow `PR validation` executa `typecheck` + `build` a cada push da branch;
- último head validado após as mudanças acima passou com sucesso;
- Preview Vercel automático permanece ligado à branch;
- nenhuma alteração desta rodada foi mergeada na `main` ou promovida automaticamente para Production.

## Bloqueios externos ou decisões que não devem ser inventadas pelo código

### Marca
- nome definitivo, logo, domínio, e-mails, SEO final, texto dos certificados e identidade jurídica da marca aguardam escolha/clearance;
- não trocar `CURIÓ` em massa antes de decidir a marca definitiva.

### Jurídico/contábil
- preencher identificação real da prestadora (nome/razão social, CPF/CNPJ, endereço etc.);
- definir regras comerciais reais: vencimento, reajuste, faltas, reagendamento, cancelamento, inadimplência e eventual multa/juros;
- revisar documentos com profissional jurídico/contábil antes da publicação;
- depois da revisão, publicar somente as versões aprovadas;
- a infraestrutura de aceite só entra em uso quando houver documento efetivamente publicado.

### Auth/Supabase Dashboard
- `Leaked Password Protection` continua desativada no advisor; habilitação depende da configuração/plano do Supabase Auth;
- confirmar no Dashboard o Site URL e Redirect URLs do Auth apontando para o domínio oficial;
- retestar primeiro acesso e recuperação depois dessa configuração.

### IA/Gerador
- estrutura, contexto seguro e fila existem;
- falta escolher/configurar provedor/modelo e implementar/comprovar o worker real;
- não ativar provedor pago ou enviar dados a modelo externo sem decisão sobre fornecedor, custo e privacidade;
- relatórios inteligentes e correção subjetiva assistida por IA dependem desse mesmo passo;
- avaliação pedagógica humana continua obrigatória nas decisões relevantes.

### Financeiro automático
- fluxo manual de comprovantes já funciona;
- cobrança automática não deve ser criada antes de definir regras comerciais, meio de pagamento e revisão jurídica/contábil.

## Testes que continuam necessariamente visuais/autenticados

Esses itens não devem ser marcados como concluídos por inspeção de código/SQL:
- Admin: matrícula com multi-clique, edição, exclusão, Lixeira e restauração;
- Professor: login, alunos, criação/publicação de missão, agenda/reunião, mensagens e restauração;
- Aluno: missão, agenda, perfil/avatar, celebrações e isolamento;
- Família: filhos, progresso, agenda, mensagens, contrato, pagamentos e privacidade/autorizações;
- desktop, tablet e celular;
- abertura dos links de aula/reunião;
- emissão real de certificado após concluir um curso real;
- fluxo completo de curso livre, hoje bloqueado porque o banco conectado ainda não possui cursos cadastrados;
- primeiro acesso/recuperação depois de confirmar URL Configuration do Supabase Auth.

## Estado do banco conectado nesta data

- documentos jurídicos atuais: 10;
- rascunhos jurídicos: 10;
- documentos jurídicos publicados: 0;
- eventos de aceite/ciência/autorização: 0 (esperado, pois não há texto publicado);
- convites `pending/sent` para alunos na Lixeira: 0;
- comprovantes pendentes de conferência: 0;
- contratos aguardando assinatura: 0;
- cursos livres cadastrados: 0;
- certificados emitidos: 0.

Não criar dados fictícios em produção apenas para transformar esses zeros em testes verdes. O teste ponta a ponta deve acontecer com dados de aceite controlados ou em ambiente de teste adequado.
