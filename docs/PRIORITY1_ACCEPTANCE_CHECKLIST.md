# CURIÓ — Checklist de aceite da Prioridade 1

Use este checklist no preview/deploy antes do merge.

## Matrícula

- [ ] Admin abre `/admin/matriculas`.
- [ ] Seleciona responsável, aluno, professor, plano e dados acadêmicos.
- [ ] Clica várias vezes rapidamente em concluir.
- [ ] Apenas um convite/aluno é criado.
- [ ] O botão mostra estado de processamento.
- [ ] O aluno aparece em `/admin/alunos`.
- [ ] O vínculo professor-aluno existe uma única vez.
- [ ] O vínculo responsável-aluno existe uma única vez.
- [ ] Existe somente uma assinatura corrente para o aluno.
- [ ] O convite exibe “Matrícula finalizada”.
- [ ] Em erro parcial, repetir com a mesma `op` não cria outro aluno.

## Exclusão e restauração

- [ ] Excluir aluno remove da lista operacional.
- [ ] O aluno aparece em `/admin/lixeira` com mesmo ID.
- [ ] Professor deixa de considerar o aluno como vínculo operacional.
- [ ] Família deixa de considerar o aluno como vínculo operacional.
- [ ] Restaurar devolve o mesmo aluno e status anterior.
- [ ] Excluir convite remove apenas o convite da operação; não apaga aluno automaticamente.
- [ ] Excluir solicitação pública envia para a Lixeira.
- [ ] Exclusão permanente só aparece para tipos seguros.

## Agenda

- [ ] Professor abre `/professor/agenda`.
- [ ] Cria aula para aluno vinculado.
- [ ] Evento aparece na Agenda do Professor.
- [ ] Evento aparece em `/aluno/agenda` quando visível ao aluno.
- [ ] Próximo evento aparece em `/aluno`.
- [ ] Evento aparece em `/familia/agenda` quando visível à família.
- [ ] Próximo evento aparece em `/familia`.
- [ ] Link abre pelo botão “Entrar na aula”.
- [ ] Reunião somente da família não é retornada ao aluno.
- [ ] Professor não consegue criar evento para aluno sem vínculo.
- [ ] Duplo submit não cria dois eventos.

## RLS

- [ ] Professor A não lê dados operacionais do aluno do Professor B.
- [ ] Família A não lê dados da Família B.
- [ ] Aluno A não lê dados do Aluno B.
- [ ] Aluno na Lixeira não permanece acessível operacionalmente a Professor/Família/Aluno.
- [ ] Admin continua conseguindo restaurar e auditar.

## Qualidade

- [ ] `npm run typecheck` passa.
- [ ] `npm run build` passa.
- [ ] Preview desktop validado.
- [ ] Preview tablet validado.
- [ ] Preview celular validado.
- [ ] Fluxos antigos relacionados foram retestados para regressão.
