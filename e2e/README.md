# Testes E2E do Plumareli

Esta pasta mantém os testes de navegador separados das dependências da aplicação principal.

## Executar localmente

```bash
npm ci
npm install --prefix e2e
cd e2e
npx playwright install chromium
cd ..
npm --prefix e2e test
```

Por padrão, o Playwright inicia o Next.js em `http://127.0.0.1:3000` com credenciais Supabase fictícias. Isso permite validar landing, login e redirecionamentos de acesso sem usar dados reais.

Para testar um preview ou ambiente já publicado:

```bash
PLAYWRIGHT_TEST_BASE_URL="https://seu-preview.exemplo" npm --prefix e2e test
```

## Testes autenticados por perfil

Os testes de login real ficam automaticamente ignorados enquanto as credenciais abaixo não estiverem configuradas:

- `E2E_ADMIN_EMAIL` e `E2E_ADMIN_PASSWORD`
- `E2E_TEACHER_EMAIL` e `E2E_TEACHER_PASSWORD`
- `E2E_GUARDIAN_EMAIL` e `E2E_GUARDIAN_PASSWORD`
- `E2E_STUDENT_EMAIL` e `E2E_STUDENT_PASSWORD`

Use somente contas exclusivas de teste, sem dados reais de alunos. Quando essas variáveis forem fornecidas junto com `PLAYWRIGHT_TEST_BASE_URL`, a suíte confirma que cada papel entra no portal correto.

## Cobertura atual

- proposta de valor e CTA da landing;
- presença e validações básicas do formulário público;
- primeiro acesso e recuperação de senha;
- bloqueio de `/admin`, `/professor`, `/familia` e `/aluno` para visitantes;
- login dos quatro papéis quando credenciais E2E estiverem disponíveis;
- execução em Chromium desktop e viewport mobile.
