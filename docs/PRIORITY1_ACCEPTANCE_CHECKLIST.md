# CURIÓ — Checklist de aceite da Prioridade 1

Use este checklist no preview/deploy antes do merge.

> Os itens de interface continuam desmarcados até teste autenticado no preview. Os testes SQL abaixo foram executados com rollback quando criavam/alteravam dados de teste.

## Matrícula

- [ ] Admin abre `/admin/matriculas`.
- [ ] Seleciona responsável, aluno, professor, plano e dados acadêmicos.
- [ ] Clica várias vezes rapidamente em concluir.
- [ ] Apenas um convite/aluno é criado.
- [ ] O botão mostra estado de processamento.
- [ ] O aluno aparece em `/admin/alunos`.
- [ ] O vínculo professor-aluno existe uma única vez.
- [x] O vínculo responsável-aluno permanece único ao editar. *(upsert/RPC testado com rollback)*
- [x] Existe somente uma assinatura corrente para o aluno. *(constraint testada com rollback)*
- [ ] O convite exibe “Matrícula finalizada” no preview.
- [ ] Em erro parcial, repetir com a mesma `op` não cria outro aluno no fluxo visual.
- [x] Edição de dados retorna o mesmo `student_id`, sem recriar aluno. *(RPC testada com rollback)*
- [x] Professor/Plano atualizam a mesma matrícula, assinatura e vínculo. *(RPC testada com rollback)*

### Evidências de idempotência já verificadas no banco

- [x] Segunda operação idêntica em `access_invitations` é bloqueada/reutilizada sem nova linha.
- [x] Segunda solicitação idêntica em `enrollment_requests` é bloqueada sem nova linha.
- [x] Segunda assinatura `pending/active` para o mesmo aluno é bloqueada.
- [x] TeacherStudent e GuardianStudent usam chave composta + `upsert`, sem vínculo duplicado.

## Exclusão e restauração

- [ ] Excluir aluno remove da lista operacional no preview.
- [ ] O aluno aparece em `/admin/lixeira` com mesmo ID no preview.
- [x] Professor deixa de considerar aluno soft-deletado como vínculo operacional. *(teste RLS com rollback)*
- [x] Família deixa de considerar aluno soft-deletado como vínculo operacional. *(teste RLS com rollback)*
- [ ] Restaurar aluno devolve o mesmo aluno e status anterior no preview.
- [ ] Excluir convite remove apenas o convite da operação; não apaga aluno automaticamente no preview.
- [ ] Excluir solicitação pública envia para a Lixeira no preview.
- [x] Exclusão permanente fica limitada aos tipos explicitamente seguros no código.
- [x] Professor: retirada/restauração de acesso preserva vínculos. *(teste com rollback)*
- [ ] Família: retirada/restauração preserva filhos/assinaturas. *(código implementado; teste transacional específico ainda pendente)*
- [x] Mensagem administrativa: soft delete → Lixeira → restauração com mesmo ID. *(teste com rollback)*
- [x] Conteúdo administrativo: arquivado → Lixeira → status anterior restaurado. *(material testado com rollback)*
- [x] Documento operacional preserva mesmo ID e `file_path` na restauração. *(teste com rollback)*
- [x] Documento soft-deletado deixa de ser visível à conta somente Família. *(teste RLS com rollback)*

## Agenda e reuniões

- [ ] Professor abre `/professor/agenda` no preview.
- [ ] Cria aula para aluno vinculado no preview.
- [ ] Evento aparece na Agenda do Professor.
- [ ] Evento aparece em `/aluno/agenda` quando visível ao aluno.
- [ ] Próximo evento aparece em `/aluno`.
- [ ] Evento aparece em `/familia/agenda` quando visível à família.
- [ ] Próximo evento aparece em `/familia`.
- [ ] Link abre pelo botão “Entrar na aula” / “Entrar na reunião”.
- [x] Evento marcado como invisível ao aluno não é retornado ao papel Aluno. *(teste RLS com rollback)*
- [x] Evento marcado como invisível à família não é retornado ao papel Família. *(teste RLS com rollback)*
- [x] Professor não consegue criar evento para aluno sem vínculo. *(RPC rejeitou a operação)*
- [x] Duas chamadas idênticas da RPC geram um único evento e um único vínculo. *(teste com rollback)*
- [x] Helper de reunião retorna somente responsáveis de alunos vinculados ao Professor. *(teste de escopo)*

## Missões e Gerador

- [x] Criação de Missão é atômica: missão + questão + gabarito ficam na mesma operação.
- [x] Duas chamadas idênticas de criação retornam o mesmo ID e deixam 1 missão, 1 questão e 1 gabarito. *(rollback)*
- [x] Atribuição de missão já usa chave única `(mission_id, student_id)` e `ON CONFLICT`.
- [x] Fila do Gerador possui idempotência por usuário/pedido/dia.
- [x] Duas inserções equivalentes resultam em um único `generation_job`. *(rollback)*
- [x] `job_type` do Gerador é traduzuzido para os valores aceitos pelo banco e o tipo de produto fica em `input.requested_output_type`.
- [ ] Processamento real do Gerador termina um job e cria/entrega o produto solicitado no ambiente conectado.
- [ ] Processador/provedor de geração confirmado e testado; não considerar a IA pronta apenas porque o formulário e a fila existem.
- [ ] Modelos visuais de PDF/Caderno CURIÓ validados com identidade, paginação e área de respostas.

## RLS e segurança

- [x] Professor vê somente a quantidade esperada de alunos vinculados no teste de isolamento.
- [x] Família vê somente a quantidade esperada de filhos vinculados no teste de isolamento.
- [x] Aluno A vê o próprio registro e não vê o Aluno B. *(teste sintético com rollback)*
- [x] Aluno A recebe apenas a própria atribuição de missão, avaliação e agenda. *(teste sintético com rollback)*
- [x] Aluno na Lixeira não permanece acessível operacionalmente a Professor/Família.
- [ ] Admin continua conseguindo restaurar e auditar pelo fluxo de interface.
- [x] Helper RLS de mensagens permite participantes autenticados e não fica aberto ao anônimo.
- [x] RLS de materiais foi corrigido para atribuições por aluno, turma e grupo pedagógico.
- [x] Nenhuma policy pública restante referencia helper `private.*` sem `EXECUTE` para `authenticated`.
- [x] `set_student_avatar` e `teacher_linked_guardian_names` deixaram de ser executáveis pelo papel `anon`.
- [x] `guardian_portal_pins` não possui grants diretos para `anon/authenticated`; acesso permanece pelas RPCs autenticadas com bloqueio de tentativas.
- [x] Respostas recebem baseline de segurança: `nosniff`, anti-frame, referrer policy, permissions policy e HSTS em produção Vercel.
- [x] Recuperação de senha não usa mais `Origin` arbitrário como primeira fonte; prioriza `NEXT_PUBLIC_SITE_URL` configurada.
- [ ] Ativar Leaked Password Protection no Supabase Auth e retestar primeiro acesso/recuperação.
- [ ] Confirmar `NEXT_PUBLIC_SITE_URL` e Site URL/Redirect URLs do Supabase Auth apontando para o endereço oficial antes de remover o projeto Vercel antigo.

## Financeiro e mensagens

- [x] Financeiro auditado: hoje é somente leitura em `payments`/`subscriptions`; não existe action de criar cobrança/pagamento para duplicar.
- [x] Envio/criação de mensagem não foi encontrado no código inicial; edição/remoção existente foi preservada, com Lixeira para exclusão administrativa.
- [x] Envio Professor → Família implementado sobre `message_threads`, `message_thread_participants` e `messages` existentes, sem sistema paralelo.
- [x] Envio protegido por `request_key` e operação atômica/idempotente no banco.
- [x] Templates reutilizáveis de comunicação usam `content_templates` existentes.
- [x] Variáveis simples continuam suportadas: `{{responsavel_nome}}`, `{{aluno_nome}}`, `{{professor_nome}}`, `{{escola}}`, `{{ano_escolar}}`.
- [x] Variáveis do prompt suportadas com contexto real: `{{responsavel.nome}}`, `{{aluno.nome}}`, `{{professor.nome}}`, `{{agenda.titulo}}`, `{{agenda.data}}`, `{{agenda.horario}}`, `{{agenda.link}}`, `{{missao.nome}}`, `{{missao.prazo}}`.
- [x] Contexto de Agenda/Missão é revalidado no servidor contra Professor + Aluno antes do envio.
- [x] Preview acusa variável sem valor e o servidor impede que placeholder cru seja enviado à Família.
- [x] Nove modelos CURIÓ iniciais estão cadastrados, incluindo aula, reunião, prazo, ausência e alteração de encontro.
- [x] Botão opcional de ação (`action_label` + `action_url`) aparece para a Família e aceita rota interna ou HTTPS depois da resolução das variáveis.
- [x] RLS de mensagens endurecido para impedir autoentrada em thread alheia e manter conversa familiar condicionada ao vínculo atual com o aluno.
- [ ] Envio, preview, template, contexto, botão de ação e leitura pela Família validados visualmente no preview autenticado.

## Documentos legais e privacidade

- [x] Textos legais usam `legal_documents` existente, com versão, rascunho/publicação e rota pública por slug.
- [x] Admin consegue editar rascunho; versão publicada exige nova revisão para preservar histórico.
- [x] Publicação já exige texto ou `file_path`; documento vazio não pode ser publicado pelo fluxo atual.
- [x] Placeholders antigos que estavam `published` sem conteúdo voltaram automaticamente para `draft` e agora podem ser editados.
- [x] O rodapé público só exibe documentos publicados que realmente tenham texto/arquivo.
- [ ] Preencher/revisar e publicar Termos de Uso, Privacidade da Criança, Consentimento, Contrato e demais documentos aplicáveis; conteúdo jurídico deve ser validado pela responsável/assessoria competente.
- [ ] Confirmar visualmente os links legais no site público depois da publicação.

## Qualidade e deploy

- [x] `npm run typecheck` passa no GitHub Actions.
- [x] `npm run build` passa no GitHub Actions.
- [x] Branch gera Preview automaticamente no Vercel conectado.
- [ ] Preview desktop validado.
- [ ] Preview tablet validado.
- [ ] Preview celular validado.
- [ ] Fluxos antigos relacionados foram retestados para regressão.
- [ ] Confirmar que o projeto que servirá o endereço oficial possui as mesmas variáveis de ambiente e configurações antes de remover o projeto/endereço antigo.

## P2 já iniciado sem bloquear o fechamento do P1

- [x] Avatar persistente por aluno usando `student_game_profiles.avatar_character_id` e `characters.assets` existentes.
- [x] Família vinculada consegue definir o avatar do filho sem ganhar permissão geral de UPDATE em estrelas/nível/streak. *(RPC testada com rollback)*
- [x] `/aluno/perfil` usa a rota existente e passou typecheck/build.
- [ ] Avatar validado visualmente em desktop/tablet/celular no preview.
- [x] Templates/variáveis de mensagens implementados sobre `content_templates` e mensagens existentes, com preview, contexto real, botão de ação e idempotência.
- [ ] Mensagens reutilizáveis validadas visualmente em desktop/tablet/celular no preview.
- [ ] Responsividade completa das quatro áreas validada visualmente.
- [ ] Gerador completo e modelos visuais PDF validados end-to-end.
