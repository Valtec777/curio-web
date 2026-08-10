# Notas de aplicação no Supabase — 10/08/2026

Projeto: `curio-app`

As mudanças desta branch foram versionadas em migrations. Durante a estabilização, parte do SQL também foi aplicada diretamente ao projeto conectado para validar comportamento sem apagar dados.

## Aplicado e verificado

- colunas e índices de idempotência/soft delete de matrícula;
- índice único de Lixeira ativa por entidade;
- versão 2 da Edge Function `curio-access-admin`;
- colunas/índice de idempotência da agenda;
- RLS principal da agenda respeitando visibilidade;
- RPC `create_teacher_agenda_event` para evento + vínculo atômicos;
- proteção de acesso para alunos em soft delete;
- colunas de professor/plano/finalização em `access_invitations`;
- índice que impede duas assinaturas `pending/active` por aluno.

## Aplicação parcial pelo conector

O conector recusou algumas alterações DDL/permissões em chamadas específicas. Nesses casos:

- não foi feito bypass da proteção do conector;
- a versão final desejada permanece registrada nas migrations;
- a proteção principal equivalente foi aplicada quando possível;
- esses itens devem ser conferidos no fluxo normal de migrations do ambiente antes do merge/deploy definitivo.

## Dados

Nenhum registro duplicado histórico foi removido automaticamente.

Os testes sintéticos de idempotência foram executados dentro de transações com `ROLLBACK`.
