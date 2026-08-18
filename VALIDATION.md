# PLUMARELI — Validação de mudanças

Este arquivo descreve a validação mínima esperada antes de integrar mudanças na `main`.

## Validação automatizada

O workflow de pull request deve executar, nesta ordem:

```bash
npm ci
npm run assets:check
npm run typecheck
npm run build
```

### `npm run assets:check`

Verifica referências locais de `/brand` e `/mascotes` usadas por `app` e `components`.

- passa quando o arquivo existe em `public`;
- também aceita um fallback local válido configurado em `next.config.mjs`;
- falha quando uma referência não possui arquivo nem fallback;
- avisa quando uma imagem grande em uso merece versão WebP/AVIF.

## Validação funcional

Depois do CI, validar no preview da Vercel os fluxos afetados com contas separadas quando aplicável:

- Admin;
- Professor;
- Aluno;
- Família.

Mudanças de interface devem ser conferidas em desktop, tablet e mobile, incluindo tema escuro e recursos de acessibilidade quando a área afetada os utiliza.

## Banco e legado técnico

Não renomear migrations já aplicadas, funções/RPCs, colunas ou outros identificadores persistidos apenas para substituir `curio` por `plumareli`. Esse legado deve ser tratado como compatibilidade técnica até existir uma migração específica e validada.

Novos nomes públicos e novos identificadores que não dependam do legado devem usar PLUMARELI.

## Critério de integração

Um PR não deve ser tratado como pronto apenas porque compilou. O mínimo é:

1. validação de assets;
2. typecheck;
3. build;
4. checks do GitHub concluídos;
5. preview da Vercel concluído quando disponível;
6. revisão funcional proporcional ao risco da alteração.
