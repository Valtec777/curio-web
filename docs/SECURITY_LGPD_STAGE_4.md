# Etapa 4 — Segurança e LGPD

Esta etapa endurece o site público sem ampliar a coleta de dados e sem aplicar DDL diretamente no banco de produção a partir do PR.

## Proteções implementadas no código

- cabeçalhos HTTP para reduzir clickjacking, MIME sniffing, vazamento de referência e uso indevido de objetos/embeds;
- CSP deliberadamente mínima para não quebrar scripts do Next.js: `base-uri`, `frame-ancestors`, `form-action` e `object-src`;
- primeiro contato limitado aos campos já declarados na landing: responsável, WhatsApp, e-mail, ano escolar e consentimento;
- lista fechada de anos escolares no Server Action;
- telefone aceita somente caracteres de telefone e exige entre 8 e 15 dígitos;
- e-mail é normalizado para minúsculas;
- ano escolar precisa existir no banco antes do registro do interesse;
- campos detalhados da criança continuam gravados como `null`/vazios no primeiro contato;
- `security:check` entra no `prebuild` para impedir regressões silenciosas;
- Playwright valida os cabeçalhos e confirma que a landing não voltou a pedir dados detalhados do aluno.

## Proteções que já existiam na base atual

A base `conversion/landing-optimization-2026-08-20` já inclui endurecimento de RLS para matrícula pública, minimização do formulário, unicidade diária por e-mail/telefone e publicação dos avisos de privacidade.

## Auditoria Supabase realizada em 21/08/2026

O Security Advisor do projeto de produção ainda aponta itens que merecem uma revisão específica de banco/Auth antes de serem alterados:

1. proteção contra senhas vazadas está desativada no Supabase Auth;
2. a extensão `citext` está instalada no schema `public`;
3. várias funções `SECURITY DEFINER` são executáveis por `authenticated` e duas também por `anon`; algumas podem ser intencionais, mas cada função precisa ter autorização interna e `search_path` seguro verificados antes de mudar privilégios;
4. `guardian_portal_pins` possui RLS sem policy direta, compatível com acesso somente via RPC, mas o contrato deve continuar sendo auditado.

Esses pontos não foram alterados automaticamente nesta etapa para evitar quebra de autenticação, certificados, indicações, missões ou portal da família sem uma validação de banco isolada.

## Critério de conclusão

Antes de mesclar:

- `npm run security:check` deve passar;
- typecheck/build devem passar;
- Playwright desktop/mobile deve passar;
- preview da Vercel deve responder com os cabeçalhos definidos em `next.config.mjs`.
