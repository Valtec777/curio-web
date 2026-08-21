# Fase 9 — prontidão de go-live

## Objetivo

Transformar os bloqueios externos da release candidate em gates explícitos e verificáveis antes de qualquer publicação em produção. Esta fase não faz deploy, merge ou promoção automática.

## O que a Fase 9 adiciona

1. `npm run go-live:check` valida que o contrato de go-live está versionado.
2. `E2E_REQUIRE_AUTH=1` torna os quatro logins reais obrigatórios, sem `skip` silencioso.
3. `.github/workflows/go-live-readiness.yml` executa, manualmente, a suíte completa contra uma URL HTTPS candidata.
4. O workflow usa o environment GitHub `production`, permitindo adicionar reviewers e regras de proteção no repositório.
5. O gate exige confirmação explícita de proteção contra senhas vazadas e rollback pronto.

## Secrets obrigatórios

Use somente contas dedicadas a E2E, sem dados reais de alunos ou responsáveis:

- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_TEACHER_EMAIL`
- `E2E_TEACHER_PASSWORD`
- `E2E_GUARDIAN_EMAIL`
- `E2E_GUARDIAN_PASSWORD`
- `E2E_STUDENT_EMAIL`
- `E2E_STUDENT_PASSWORD`

Preferencialmente, armazene-os no environment `production` do GitHub. Não use contas pessoais e não coloque credenciais em arquivos, logs, PRs ou variáveis `NEXT_PUBLIC_*`.

## Pré-condições de corte

Antes de executar o gate manual:

- Release Candidate aprovada e CI verde.
- Preview/deployment candidato já publicado em URL HTTPS.
- `Leaked Password Protection` habilitada no Supabase Auth. A documentação atual do Supabase recomenda impedir senhas já vazadas via HaveIBeenPwned; o recurso é oferecido no plano Pro e superiores.
- Quatro contas E2E válidas e vinculadas aos portais corretos.
- Plano de rollback definido, com pessoa responsável pelo corte.
- Nenhuma migration destrutiva ou mudança irreversível pendente no mesmo corte.

## Execução do gate

No GitHub Actions, execute `Go-live readiness gate` na ref exata candidata e informe:

- `target_url`: URL HTTPS candidata;
- `confirm_leaked_password_protection`: somente `true` depois da verificação no Supabase Auth;
- `confirm_rollback_ready`: somente `true` quando o rollback estiver operacional.

O workflow falha antes dos testes se faltar qualquer secret E2E, se a URL não for HTTPS, ou se uma das confirmações estiver falsa.

> O evento `workflow_dispatch` precisa estar disponível na branch reconhecida pelo GitHub para execução manual. Enquanto a Fase 9 estiver apenas em PR, o CI comum valida a estrutura do gate, mas não substitui a execução manual final contra o ambiente candidato.

## Critérios de GO

O corte só está autorizado quando, na mesma ref candidata:

- `go-live:check` em modo estrito passa;
- todos os checks estáticos da release passam;
- TypeScript passa;
- Playwright termina sem skips de autenticação e sem falhas em desktop/mobile;
- os quatro perfis autenticam e chegam ao portal esperado;
- landing, privacidade, headers, SEO e analytics no-PII continuam verdes;
- o deployment candidato está saudável.

## Critérios de NO-GO

Não publicar/promover se ocorrer qualquer um destes casos:

- proteção contra senhas vazadas não confirmada;
- qualquer credencial E2E ausente;
- qualquer login de papel falha ou redireciona para portal incorreto;
- regressão pública, de segurança ou responsividade;
- migration pendente, divergente ou sem rollback conhecido;
- deployment candidato não saudável.

## Corte

A promoção para produção deve ser um passo separado e explícito depois do gate verde. Não combine a decisão de GO com alterações adicionais de código ou banco.

Registre antes do corte:

- SHA/ref aprovada;
- URL/deployment candidato;
- horário do corte;
- responsável;
- último deployment conhecido como bom para rollback.

## Verificação pós-corte

Imediatamente após a promoção:

1. abrir a landing pública e confirmar CTA/formulário;
2. validar `/login` e recuperação/primeiro acesso;
3. repetir os quatro logins E2E contra a URL final;
4. confirmar headers de segurança e ausência de PII nos eventos públicos;
5. observar erros de aplicação/Auth e falhas de acesso inesperadas;
6. confirmar que nenhum dado real foi criado pelas contas de teste além do estritamente necessário.

## Rollback

Se um gate crítico pós-corte falhar:

1. interromper novas mudanças;
2. promover novamente o último deployment conhecido como bom;
3. não reverter migration de banco automaticamente se houver risco de perda de dados;
4. para migration incompatível, aplicar somente a estratégia de rollback previamente revisada;
5. repetir landing + quatro logins após a reversão;
6. registrar causa, impacto e ação corretiva antes de nova tentativa.

## Itens que continuam fora do escopo automático

- habilitar `Leaked Password Protection` no Supabase Auth, pois o conector atual não oferece escrita dessa configuração;
- cadastrar/rotacionar secrets E2E no GitHub;
- aprovar manualmente environment/reviewer rules;
- promover deployment para produção;
- migrations destrutivas ou hardening amplo de índices/RLS sem staging e evidência de workload.
