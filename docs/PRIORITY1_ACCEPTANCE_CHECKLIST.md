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

## Exclusão e restauração

- [ ] Excluir aluno remove da lista operacional no preview.
- [ ] O aluno aparece em `/admin/lixeira` com mesmo ID no preview.
- [x] Professor deixa de considerar aluno soft-deletado como vínculo operacional. *(teste RLS com rollback)*
- [x] Família deixa de considerar aluno soft-deletado como vínculo operacional. *(teste RLS com rollback)*
- [ ] Restaurar aluno devolve o mesmo aluno e status anterior no preview.
- [ ] Excluir convite remove apenas o convite da operação; não apaga aluno automaticamente no preview.
- [ ] Excluir solicitação pública envia para a Lixeira no preview.
- [x] Exclusão permanente fica limitada aos tipos explicitamente seguros no código.
- [ ] Excluir/restaurar Professor preserva perfil, vínculos e histórico no preview.
- [ ] Excluir/restaurar Família preserva perfil, filhos, assinaturas e histórico no preview.
- [x] Mensagem administrativa: soft delete → Lixeira → restauração com mesmo ID. *(teste com rollback)*
- [x] Conteúdo administrativo: arquivado → Lixeira → status anterior restaurado. *(material testado com rollback)*
- [x] Documento operacional preserva mesmo ID e `file_path` na restauração. *(teste com rollback)*
- [x] Documento soft-deletado deixa de ser visível à conta somente Família. *(teste RLS com rollback)*

## Agenda

- [ ] Professor abre `/professor/agenda` no preview.
- [ ] Cria aula para aluno vinculado no preview.
- [ ] Evento aparece na Agenda do Professor.
- [ ] Evento aparece em `/aluno/agenda` quando visível ao aluno.
- [ ] Próximo evento aparece em `/aluno`.
- [ ] Evento aparece em `/familia/agenda` quando visível à família.
- [ ] Próximo evento aparece em `/familia`.
- [ ] Link abre pelo botão “Entrar na aula”.
- [x] Evento marcado como invisível ao aluno não é retornado ao papel Aluno. *(teste RLS com rollback)*
- [x] Evento marcado como invisível à família não é retornado ao papel Família. *(teste RLS com rollback)*
- [x] Professor não consegue criar evento para aluno sem vínculo. *(RPC rejeitou a operação)*
- [x] Duas chamadas idênticas da RPC geram um único evento e um único vínculo. *(teste com rollback)*

## RLS

- [x] Professor vê somente a quantidade esperada de alunos vinculados no teste de isolamento.
- [x] Família vê somente a quantidade esperada de filhos vinculados no teste de isolamento.
- [ ] Aluno A não lê dados gerais do Aluno B.
- [x] Aluno na Lixeira não permanece acessível operacionalmente a Professor/Família.
- [ ] Admin continua conseguindo restaurar e auditar pelo fluxo de interface.
- [x] Helper RLS de mensagens permite participantes autenticados e não fica aberto ao anônimo.
- [x] RLS de materiais foi corrigido para atribuições por aluno, turma e grupo pedagógico.

## Qualidade

- [x] `npm run typecheck` passa no GitHub Actions.
- [x] `npm run build` passa no GitHub Actions.
- [ ] Preview desktop validado.
- [ ] Preview tablet validado.
- [ ] Preview celular validado.
- [ ] Fluxos antigos relacionados foram retestados para regressão.
