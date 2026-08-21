# Testes E2E do Plumareli — modelo atual

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

Por padrão, o Playwright inicia o Next.js em `http://127.0.0.1:3000` com credenciais Supabase fictícias. Isso permite validar landing, login, responsividade e redirecionamentos de acesso sem usar dados reais.

Para testar um preview ou ambiente já publicado:

```bash
PLAYWRIGHT_TEST_BASE_URL="https://seu-preview.exemplo" npm --prefix e2e test
```

## Testes autenticados por perfil

No CI comum, os testes de login real ficam automaticamente ignorados enquanto as credenciais abaixo não estiverem configuradas:

- `E2E_ADMIN_EMAIL` e `E2E_ADMIN_PASSWORD`
- `E2E_TEACHER_EMAIL` e `E2E_TEACHER_PASSWORD`
- `E2E_GUARDIAN_EMAIL` e `E2E_GUARDIAN_PASSWORD`
- `E2E_STUDENT_EMAIL` e `E2E_STUDENT_PASSWORD`

Use somente contas exclusivas de teste, sem dados reais de alunos. Quando essas variáveis forem fornecidas junto com `PLAYWRIGHT_TEST_BASE_URL`, a suíte confirma que cada papel entra no portal correto.

### Modo estrito de go-live

A Fase 9 adiciona `E2E_REQUIRE_AUTH=1`. Nesse modo, faltar qualquer e-mail ou senha deixa de gerar `skip` e passa a falhar a suíte. O workflow `.github/workflows/go-live-readiness.yml` ativa esse modo automaticamente e executa a suíte completa contra uma URL HTTPS candidata.

O gate manual também exige:

- confirmação de `Leaked Password Protection` habilitada no Supabase Auth;
- confirmação de plano/responsável de rollback pronto;
- URL candidata HTTPS que não seja localhost ou domínio de exemplo;
- os oito secrets E2E dos quatro perfis.

## Cobertura do modelo atual

- hero atual com Irara, proposta de valor e CTA do primeiro contato;
- formulário reduzido e regra de minimização de dados;
- link da Política de Privacidade e validações nativas;
- primeiro acesso e recuperação de senha;
- bloqueio de `/admin`, `/professor`, `/familia` e `/aluno` para visitantes;
- login dos quatro papéis quando credenciais E2E estiverem disponíveis;
- contrato responsivo do header e ausência de rolagem horizontal;
- execução em Chromium desktop e viewport Pixel 7;
- gate estrito separado para autorização de go-live.
