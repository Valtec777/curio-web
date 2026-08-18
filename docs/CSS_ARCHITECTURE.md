# PLUMARELI — Arquitetura de CSS

Este documento registra a ordem atual das folhas globais e evita a criação de novas camadas de correção sem necessidade.

## Regra principal

Não criar novos arquivos com nomes como `urgent-*`, `final-*`, `fix-*` ou `polish-*` para corrigir um seletor isolado. Alterações novas devem ir para o arquivo dono daquele contexto sempre que possível.

Os arquivos legados existentes permanecem importados enquanto não houver teste visual suficiente para consolidá-los com segurança.

## Camadas atuais

1. **Base e responsividade:** `globals.css`, `responsive.css`, `accessibility.css`.
2. **Shell e navegação:** `shell-refinements.css`, `shell-role-fixes.css`, `sidebar-final.css`.
3. **Áreas específicas:** `family-workspace.css`, `family-mobile-selector.css`, `referrals.css`, `onboarding-launcher-compact.css`.
4. **Marca e acabamento:** `brand-slot.css`, `site-polish.css`, `final-polish.css`, `seasonal.css`.
5. **Mobile/tablet:** `mobile-tablet-final.css`, `mobile-tablet-complete.css`, `mobile-targeted-fixes.css`.
6. **Compatibilidade legada:** `urgent-preview-fixes.css`, `urgent-fixes.css`, `dark-mode-safety.css`.

A ordem de importação em `app/layout.tsx` é parte do comportamento visual porque seletores posteriores podem sobrescrever os anteriores.

## Como consolidar no futuro

Para remover uma camada legada:

1. identificar quais seletores dela ainda vencem a cascata;
2. mover cada regra para o arquivo responsável pelo componente ou contexto;
3. validar desktop, tablet e mobile nos perfis Admin, Professor, Família e Aluno;
4. validar tema claro/escuro e recursos de acessibilidade;
5. só então remover o import e o arquivo antigo.

Não consolidar várias folhas em um único PR sem comparação visual antes/depois.

## Convenção de nomes

Novas folhas globais devem descrever responsabilidade, não momento da correção. Exemplos adequados: `student-workspace.css`, `public-site.css`, `app-shell.css`. Evitar nomes temporais como `final`, `urgent`, `complete` ou `fixes`.
