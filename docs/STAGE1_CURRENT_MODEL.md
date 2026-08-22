# Etapa 1 — modelo atual

Esta etapa não reaplica as folhas de correção do modelo antigo. A branch `conversion/landing-optimization-2026-08-20` já consolidou a responsividade em `app/responsive.css` e a landing pública na cadeia `public-brand.css → public.css → public-site.css`.

O objetivo desta revisão é impedir regressões nessa arquitetura:

- ordem global de CSS validada antes do build;
- cadeia pública validada explicitamente;
- um único entrypoint de CSS por perfil autenticado;
- contrato responsivo mínimo validado para tablet, mobile e celulares menores;
- proteção contra overflow horizontal, quebra do shell autenticado e redução incorreta das ações do header.

O `prebuild` executa `css:check`, `responsive:check` e `color:check`, portanto uma regressão estrutural bloqueia o deploy.
