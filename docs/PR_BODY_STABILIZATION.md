# Estabilização CURIÓ — Prioridade 1

## O que mudou

- matrícula administrativa idempotente;
- proteção real contra duplo clique no frontend e backend;
- retry preservando a mesma operação;
- professor e plano incluídos no fechamento da matrícula;
- soft delete de alunos, convites e solicitações;
- Lixeira com restauração e exclusão permanente restrita;
- agenda operacional Professor → Aluno → Família;
- link de aula/reunião nas áreas participantes;
- reforço de RLS e remoção operacional de aluno excluído;
- Edge Function `curio-access-admin` versionada no repositório.

## Causa raiz principal

O fluxo institucional criava o aluno antes de reservar uma operação idempotente. Requisições repetidas podiam criar vários alunos/convites em segundos. A auditoria do banco confirmou um grupo histórico de cinco registros desse tipo; nenhum foi removido automaticamente.

## Validações já executadas

- migration de idempotência/soft delete aplicada;
- Edge Function v2 implantada;
- testes transacionais com rollback confirmaram bloqueio de duplicidade em `access_invitations` e `enrollment_requests`;
- índices críticos confirmados no banco;
- agenda/RLS e soft delete aplicados ao projeto conectado dentro dos limites do conector.

## Ainda precisa de validação no preview

- typecheck/build;
- fluxo autenticado end-to-end das quatro áreas;
- desktop/tablet/celular;
- regressão das funcionalidades antigas relacionadas.

Ver também:
- `docs/STABILIZATION_AUDIT_2026-08-10.md`;
- `docs/PRIORITY1_ACCEPTANCE_CHECKLIST.md`;
- `docs/DB_APPLY_NOTES_2026-08-10.md`.
