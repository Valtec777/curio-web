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
- [ ] O vínculo responsável-aluno existe uma única vez.
- [x] Existe somente uma assinatura corrente para o aluno. *(constraint testada com rollback)*
- [ ] O convite exibe “Matrícula finalizada”.
- [ ] Em erro parcial, repetir com a mesma `op` não cria outro aluno.

### Evidências de idempotência já verificadas no banco

- [x] Segunda operação idêntica em `access_invitations` é bloqueada/reutilizada sem nova linha.
- [x] Segunda solicitação idêntica em `enrollment_requests` é bloqueada sem nova linha.
- [x] Segunda assinatura `pending/active` para o mesmo aluno é bloqueada.

## Exclusão e restauração

- [ ] Excluir aluno remove da lista operacional.
- [ ] O aluno aparece em `/admin/lixeira` com mesmo ID.
- [x] Professor deixa de considerar aluno soft-deletado como vínculo operacional. *(teste RLS com rollback)*
- [x] Família deixa de considerar aluno soft-deletado como vínculo operacional. *(teste RLS com rollback)*
- [ ] Restaurar devolve o mesmo aluno e status anterior.
- [ ] Excluir convite remove apenas o convite da operação; não apaga aluno automaticamente.
- [ ] Excluir solicitação pública envia para a Lixeira.
- [ ] Exclusão permanente só aparece para tipos seguros.
- [ ] Excluir/restaurar Professor preserva perfil, vínculos e histórico.
- [ ] Excluir/restaurar Família preserva perfil, filhos, assinaturas e histórico.

## Agenda

- [ ] Professor abre `/professor/agenda`.
- [ ] Cria aula para aluno vinculado.
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

## Qualidade

- [ ] `npm run typecheck` passa.
- [ ] `npm run build` passa.
- [ ] Preview desktop validado.
- [ ] Preview tablet validado.
- [ ] Preview celular validado.
- [ ] Fluxos antigos relacionados foram retestados para regressão.
