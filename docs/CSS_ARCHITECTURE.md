# PLUMARELI — Arquitetura de CSS

A interface usa uma arquitetura em camadas semânticas. O objetivo é manter a identidade PLUMARELI sem depender de folhas temporárias que vencem a cascata apenas por serem importadas por último.

## Regra principal

Não criar novos arquivos com nomes como `urgent-*`, `final-*`, `complete-*`, `*-fixes.css` ou `*-polish.css` para corrigir um seletor isolado. A alteração deve ir para a camada dona do comportamento.

Execute `npm run css:check` ao alterar imports de CSS. O script impede que folhas temporárias voltem ao layout global e garante um único entrypoint por ambiente autenticado.

## Camadas globais

A ordem em `app/layout.tsx` é deliberada:

1. **`globals.css`** — estilos históricos e componentes ainda não migrados. É a camada de compatibilidade; não deve receber novos tokens nem novas correções globais.
2. **`design-system.css`** — fonte de verdade para tokens, tipografia, superfícies, controles, temas, foco, movimento e primitivas compartilhadas.
3. **`app-shell.css`** — sidebar, navegação, modo compacto e ações flutuantes dos ambientes internos.
4. **`brand-slot.css`** — dimensões e comportamento da assinatura/símbolo da marca.
5. **`referrals.css`** — contexto específico do programa de indicações.
6. **`responsive.css`** — única camada global de viewport, grids, tabelas, shell mobile/tablet e telas especiais.
7. **`accessibility.css`** — recursos de acessibilidade que precisam vencer a composição visual comum.
8. **`onboarding-launcher-compact.css`** — launcher específico de onboarding.

Folhas antigas de patch global (`urgent-*`, `*-final`, `*-complete`, `site-polish`, `final-polish`, `dark-mode-safety`, `shell-role-fixes` etc.) foram removidas da árvore ativa depois que suas responsabilidades foram absorvidas pelas camadas acima.

## Design tokens

Novos valores compartilhados devem usar o namespace `--plum-*` de `design-system.css`:

- marca: `--plum-navy`, `--plum-blue`, `--plum-purple`, `--plum-pink`, `--plum-lime`, `--plum-yellow`;
- superfícies e texto: `--plum-canvas`, `--plum-surface`, `--plum-surface-raised`, `--plum-text`, `--plum-text-muted`, `--plum-border`;
- espaçamento: `--plum-space-*`;
- raios: `--plum-radius-*`;
- sombras: `--plum-shadow-*`;
- movimento: `--plum-duration`, `--plum-ease`.

Aliases antigos como `--blue`, `--ink`, `--curio-surface` e `--curio-radius-*` continuam disponíveis temporariamente para não quebrar seletores legados. Código novo deve preferir `--plum-*`.

## Ambientes autenticados

Cada layout importa exatamente um entrypoint:

- Aluno: `app/aluno/student.css`;
- Professor: `app/professor/teacher.css`;
- Família: `app/familia/family.css`;
- Admin: `app/admin/admin.css`.

Esses entrypoints tornam a ordem interna explícita e evitam que TSX acumule imports de `fix`, `polish`, `manual` ou detalhes de componente. Os arquivos históricos internos ainda podem ser consolidados fisicamente de forma incremental, sem alterar a API do layout.

Os estilos de Família ficam no layout da Família e não são mais enviados para a landing pública.

## Onde colocar uma mudança

- Cor, fonte, raio, sombra, espaçamento, botão, input, card ou tema: `design-system.css`.
- Sidebar, navegação ou comportamento compacto: `app-shell.css`.
- Regra que existe apenas por causa do tamanho da tela: `responsive.css`.
- Regra exclusiva de um perfil: entrypoint/contexto daquele perfil.
- Regra exclusiva de um produto/módulo: arquivo do módulo, desde que não repita uma primitiva do design system.
- Ajuste de contraste/acessibilidade: prefira tokens de tema; use `accessibility.css` quando for comportamento assistivo.

## Critérios de validação

Mudanças estruturais de CSS devem validar:

1. build/preview sem erro;
2. landing e autenticação em desktop e celular;
3. Admin, Professor, Família e Aluno em desktop e mobile;
4. tema claro e escuro;
5. foco por teclado e redução de movimento;
6. tabelas e modais sem overflow horizontal.

A consolidação não é uma autorização para redesenhar módulos. A identidade, os mascotes e os fluxos existentes devem ser preservados; melhorias visuais devem vir de consistência, hierarquia e acabamento.
