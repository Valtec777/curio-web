# CURIÓ v1 — Validação desta entrega

## Verificado nesta sessão

- 38 arquivos TypeScript/TSX analisados sintaticamente: OK.
- Uso de `@supabase/ssr`: presente.
- Helpers antigos `@supabase/auth-helpers`: ausentes.
- RLS habilitado no schema da aplicação.
- RPC protegida de atribuição de Missão Cuca presente.
- Recalculo de estado de habilidade presente.
- Rota SSR de confirmação de e-mail presente.
- Nenhum nome completo do aluno piloto real foi usado como fixture ou seed.

## Não validado nesta sessão

O `npm install` completo e, por consequência, `npm run typecheck` e
`npm run build` não puderam ser executados porque o registry de pacotes
disponível no ambiente desta sessão não fornece `@supabase/ssr`.

Isso significa que a entrega foi validada estruturalmente e
sintaticamente, mas não deve ser tratada como build de produção já
homologado.

No ambiente local, depois de configurar `.env.local`, execute:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Depois valide o fluxo com contas separadas de Admin, Professor, Aluno e Família.
