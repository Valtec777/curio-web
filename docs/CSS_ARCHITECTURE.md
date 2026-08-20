# PLUMARELI — Arquitetura de CSS

A interface usa uma arquitetura em camadas semânticas. O objetivo é manter a identidade PLUMARELI sem depender de folhas temporárias que vencem a cascata apenas por serem importadas por último.

## Regra principal

Não criar novos arquivos com nomes como `urgent-*`, `final-*`, `complete-*`, `*-fixes.css` ou `*-polish.css` para corrigir um seletor isolado. A alteração deve ir para a camada dona do comportamento.

Execute `npm run css:check` ao alterar imports de CSS. O mesmo check também roda no `prebuild`, então uma regressão estrutural bloqueia o build antes do deploy.

## Camadas globais

A ordem em `app/layout.tsx` é deliberada:

1. **`globals.css`** — estilos históricos e componentes ainda não migrados. É a camada de compatibilidade; não deve receber novos tokens nem novas correções globais.
2. **`design-system.css`** — tokens de marca, tipografia, espaçamento, raios, sombras, movimento e primitivas compartilhadas.
3. **`themes.css`** — valores semânticos e ambientação dos temas claro/escuro. É o único arquivo que deve decidir canvas, superfícies, contraste, inputs e atmosfera temática.
4. **`app-shell.css`** — sidebar, navegação, modo compacto e ações flutuantes dos ambientes internos.
5. **`brand-slot.css`** — dimensões e comportamento da assinatura/símbolo da marca.
6. **`public-site.css`** — direção editorial da landing e demais padrões exclusivamente públicos; também agrega `referrals.css` para não criar uma camada global adicional.
7. **`responsive.css`** — única camada global de viewport, grids, tabelas, shell mobile/tablet e telas especiais.
8. **`accessibility.css`** — preferências assistivas: leitura confortável, foco/simplicidade, redução de estímulos e foco visível. Não define tema claro/escuro.
9. **`onboarding-launcher-compact.css`** — launcher específico de onboarding.

Folhas antigas de patch global (`urgent-*`, `*-final`, `*-complete`, `site-polish`, `final-polish`, `dark-mode-safety`, `shell-role-fixes` etc.) foram removidas da árvore ativa depois que suas responsabilidades foram absorvidas pelas camadas acima.

## Design tokens

Novos valores compartilhados usam o namespace `--plum-*`:

- marca: `--plum-navy`, `--plum-blue`, `--plum-purple`, `--plum-pink`, `--plum-lime`, `--plum-yellow`;
- superfícies e texto: `--plum-canvas`, `--plum-canvas-subtle`, `--plum-surface`, `--plum-surface-raised`, `--plum-surface-soft`, `--plum-text`, `--plum-text-muted`, `--plum-border`;
- espaçamento: `--plum-space-*`;
- raios: `--plum-radius-*`;
- sombras: `--plum-shadow-*`;
- movimento: `--plum-duration`, `--plum-ease`.

`design-system.css` define a base e os fallbacks. `themes.css` fornece os valores finais de conforto para claro e escuro. Aliases antigos como `--blue`, `--ink`, `--curio-surface` e `--curio-radius-*` continuam disponíveis temporariamente para não quebrar seletores legados. Código novo deve preferir `--plum-*`.

## Filosofia dos temas

Claro e escuro são ambientes desenhados separadamente, não uma simples inversão de cores.

- **Claro:** canvas creme/neutro, branco suave, bordas discretas e sombras curtas para reduzir brilho e sensação de “folha branca”.
- **Escuro:** grafite azulado, texto off-white, superfícies em camadas e acentos PLUMARELI suavizados para reduzir fadiga sem perder personalidade.
- Branco puro contra preto puro deve ser evitado em leitura longa.
- Cards não devem depender de uma borda forte para existir; hierarquia vem de superfície, espaçamento e tipografia.
- A sidebar pode manter mais identidade de marca, mas precisa diminuir luminosidade no modo escuro e evitar cards brancos isolados.

## Direção do site público

A landing usa uma linguagem mais editorial sem mudar a identidade visual da marca.

- hero com escala de capa e mascotes como parte da composição;
- seções alternam ritmos, superfícies e escalas em vez de repetir grades de cards iguais;
- azul-marinho/grafite funciona como palco; lima, rosa, roxo e amarelo entram como acentos;
- personagens podem ocupar a composição livremente, mas não devem competir com a leitura;
- movimento deve ser pequeno, opcional e respeitar redução de estímulos;
- imagens ou vídeos de fases antigas da marca não devem ser publicados apenas por serem visualmente atraentes: novos elementos públicos precisam ler claramente como PLUMARELI.

## Ambientes autenticados

Cada layout importa exatamente um entrypoint:

- Aluno: `app/aluno/student.css`;
- Professor: `app/professor/teacher.css`;
- Família: `app/familia/family.css`;
- Admin: `app/admin/admin.css`.

Esses entrypoints tornam a ordem interna explícita e evitam que TSX acumule imports de `fix`, `polish`, `manual` ou detalhes de componente. Os arquivos históricos internos ainda podem ser consolidados fisicamente de forma incremental, sem alterar a API do layout.

Os estilos de Família ficam no layout da Família e não são mais enviados para a landing pública.

## Onde colocar uma mudança

- Cor de marca, fonte, raio, sombra, espaçamento ou primitiva: `design-system.css`.
- Canvas, superfície, contraste e comportamento específico de claro/escuro: `themes.css`.
- Sidebar, navegação ou comportamento compacto: `app-shell.css`.
- Composição, ritmo e direção de arte do site público: `public-site.css`.
- Regra que existe apenas por causa do tamanho da tela: `responsive.css`.
- Regra exclusiva de um perfil: entrypoint/contexto daquele perfil.
- Regra exclusiva de um produto/módulo: arquivo do módulo, desde que não repita uma primitiva do design system.
- Preferência assistiva acionada pelo usuário: `accessibility.css`.

## Critérios de validação

Mudanças estruturais de CSS devem validar:

1. `npm run css:check` e build/preview sem erro;
2. landing e autenticação em desktop e celular;
3. Admin, Professor, Família e Aluno em desktop e mobile;
4. tema claro e escuro;
5. foco por teclado, leitura confortável, foco/simplicidade e redução de movimento;
6. tabelas e modais sem overflow horizontal.

A consolidação não é uma autorização para descaracterizar os módulos. A identidade, os mascotes e os fluxos existentes devem ser preservados; melhorias visuais devem vir de consistência, hierarquia, composição e acabamento.
