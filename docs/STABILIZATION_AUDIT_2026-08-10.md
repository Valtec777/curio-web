# CURIÓ — Auditoria e estabilização · Prioridade 1

Data: 10/08/2026
Branch: `codex/estabilizacao-curio-prioridade-1`

## Princípio aplicado

O sistema existente foi auditado antes das mudanças. As correções reutilizam as tabelas, rotas, RLS, Server Actions e Edge Functions existentes; não foi criada uma segunda arquitetura de matrícula, agenda ou usuários.

## Causa confirmada da duplicação de matrícula

A Edge Function `curio-access-admin` criava o aluno antes de reservar uma operação idempotente. Requisições repetidas podiam criar múltiplos alunos e convites antes de qualquer proteção.

A auditoria agregada do banco encontrou um grupo histórico com cinco convites do mesmo responsável/papel ligados a cinco alunos distintos em uma janela de 19 segundos. Nenhum desses registros foi removido automaticamente.

## Correções implementadas

### Matrícula e idempotência

- chave de idempotência em `access_invitations`;
- índice único parcial por operação/dia;
- Edge Function reserva o convite antes de criar aluno;
- retry reutiliza convite/aluno existente;
- botão de conclusão fica desabilitado durante envio;
- chave da operação é preservada no retry após erro parcial;
- solicitação pública de matrícula também possui fingerprint idempotente;
- professor e plano passam a fazer parte do fluxo administrativo;
- vínculo professor-aluno usa `teacher_students` por IDs;
- plano usa `subscriptions`, com uma assinatura corrente por aluno;
- matrícula só recebe marca de finalização depois dos vínculos operacionais.

### Exclusão e Lixeira

- soft delete em alunos, convites e solicitações;
- Lixeira operacional com quem excluiu, motivo, prazo e ID original;
- restauração preserva o mesmo ID;
- exclusão permanente é bloqueada quando há histórico/acesso que precisa ser preservado;
- alunos excluídos deixam o acesso operacional de Professor/Família/Aluno, mas permanecem disponíveis ao Admin para restauração e histórico;
- não foi feita limpeza automática dos duplicados históricos.

### Agenda

- fluxo real de criação na área do Professor usando `agenda_events` e `agenda_event_students` existentes;
- criação por aluno vinculado usando UUID real;
- criação idempotente e atômica de evento + vínculo;
- visibilidade separada para aluno e família;
- RLS reforçado para respeitar `visible_to_student` e `visible_to_guardian` no banco;
- link de aula/reunião aparece para Professor, Aluno e Família quando permitido;
- próximo evento aparece em Hoje do Aluno e na visão inicial da Família;
- reuniões podem ser visíveis somente para a família.

## Testes executados até aqui

### Banco — duplicidade

Teste transacional com rollback em `access_invitations`: a segunda inserção com a mesma chave foi rejeitada pelo índice único.

Teste transacional com rollback em `enrollment_requests`: a segunda inserção com a mesma chave foi rejeitada pelo índice único.

Nenhum dado sintético dos testes permaneceu no banco.

### Estrutura

Confirmada a existência dos índices:

- `access_invitations_idempotency_day_uidx`;
- `enrollment_requests_idempotency_day_uidx`;
- `subscriptions_one_current_per_student_uidx`;
- `agenda_events_teacher_idempotency_day_uidx`;
- `trash_items_active_entity_uidx`.

## Pendências desta branch antes de merge

- executar typecheck/build por CI/preview se disponível;
- validar visualmente os novos fluxos autenticados em desktop e celular;
- executar teste end-to-end com contas controladas sem criar dados reais indesejados;
- continuar a Prioridade 1 para gestão completa de Professor e revisão das demais entidades que ainda precisam entrar na Lixeira.

## Regra de segurança

Não marcar como pronto apenas porque o código foi alterado. Itens sem execução end-to-end permanecem como pendentes até validação observável.
