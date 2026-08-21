# Fase 8 — Release Candidate do modelo atual

## Escopo consolidado

A branch `release/plumareli-current-ready` parte da Etapa 7 e consolida as Etapas 1–7 do modelo atual. A Etapa 3, que permaneceu propositalmente independente durante o desenvolvimento, foi incorporada nesta release pelos dois arquivos de apresentação de produto (`public-trust-section.tsx` e seu CSS module), sem substituir o restante da cadeia cumulativa.

Nenhum dos PRs anteriores foi mesclado automaticamente durante esta consolidação.

## Gate automatizado de release

A release executa, em conjunto:

- arquitetura CSS;
- contrato responsivo;
- contraste;
- baseline de segurança;
- cache público;
- SEO/discoverability e analytics sem PII;
- política de dependências fixas;
- contrato de integração das Etapas 1–7 (`release:check`);
- TypeScript (`typecheck`);
- build de produção do Next.js;
- Playwright desktop e mobile, incluindo um cenário específico da release candidate.

O cenário consolidado confirma que a landing mantém simultaneamente proposta de valor, prévias do produto, formulário mínimo, cabeçalhos de segurança, metadados sociais e rejeição de PII no endpoint de analytics.

## Supabase — endurecimento aplicado em produção

Foi aplicada a migration `phase8_tighten_enrollment_request_privileges` para reduzir privilégios de `public.enrollment_requests` ao necessário:

- `anon`: somente `INSERT`;
- `authenticated`: `INSERT`, `SELECT` e `UPDATE` (o acesso efetivo continua sujeito às políticas RLS; `SELECT`/`UPDATE` são administrativos);
- `service_role`: sem alteração.

Foram removidos de papéis públicos/autenticados os privilégios SQL desnecessários `REFERENCES`, `TRIGGER`, `TRUNCATE` e, de `authenticated`, `DELETE`. A configuração foi consultada novamente após a migration para confirmar o resultado.

## Auditoria de SECURITY DEFINER

O Security Advisor continua sinalizando funções `SECURITY DEFINER` executáveis por `authenticated`. Uma amostra representativa e as funções de maior impacto foram inspecionadas. As operações administrativas verificam papel Admin; operações de professor validam identidade/vínculo; operações de família e aluno validam `auth.uid()` ou helpers de contexto antes de acessar dados privilegiados.

Dois RPCs são intencionalmente públicos:

- `referral_landing(text)`: fornece a superfície pública de indicação;
- `verify_free_course_certificate(text)`: verifica um certificado por código público estritamente formatado.

Por isso esses dois RPCs não tiveram `EXECUTE` revogado nesta fase. Alterá-los quebraria funcionalidades públicas existentes.

`guardian_portal_pins` permanece com RLS habilitado e sem policy direta. O acesso esperado ocorre pelos RPCs protegidos de PIN; não foi aberta policy direta para a tabela.

## Gates que ainda dependem do ambiente real

### 1. Proteção de senha vazada

O Supabase Auth ainda informa `Leaked Password Protection Disabled`. A documentação atual do Supabase recomenda habilitar a verificação contra senhas comprometidas; o recurso depende do plano aplicável. O conector disponível nesta sessão não expõe uma ação de escrita para essa configuração de Auth, portanto nenhuma alteração insegura/indireta foi tentada.

Este é um gate de go-live e deve estar ativo antes da publicação definitiva quando disponível no plano.

### 2. E2E autenticado dos quatro perfis

A suíte já contém cenários reais de login para Admin, Professor, Família e Aluno, mas eles são condicionados às credenciais abaixo:

- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`;
- `E2E_TEACHER_EMAIL` / `E2E_TEACHER_PASSWORD`;
- `E2E_GUARDIAN_EMAIL` / `E2E_GUARDIAN_PASSWORD`;
- `E2E_STUDENT_EMAIL` / `E2E_STUDENT_PASSWORD`.

Sem esses secrets no CI, os testes são explicitamente `skip`; os testes de redirecionamento de visitante e as demais jornadas públicas continuam rodando.

Este é um gate de go-live: antes da produção final, os quatro logins devem passar com contas E2E dedicadas.

### 3. `citext` no schema `public`

O advisor recomenda mover a extensão `citext` para fora de `public`. Isso não foi feito diretamente em produção nesta consolidação, pois uma mudança de schema da extensão pode afetar tipos/objetos existentes. Deve ser tratada em uma branch/staging de banco com inspeção de dependências e regressão antes do merge.

### 4. Performance Advisor

Há avisos de foreign keys sem índice, índices ainda sem uso observado e políticas RLS permissivas sobrepostas. Nenhum índice foi criado/removido e nenhuma policy foi fundida em massa nesta fase: essas alterações devem ser guiadas por workload e planos de execução, não apenas pelo lint, para evitar regressão operacional.

## Critério de saída da Fase 8

A release candidate pode ser considerada **code-green** quando CI e preview Vercel passarem no head final. Para declarar **go-live**, ainda são obrigatórios:

1. executar os quatro logins E2E com secrets reais;
2. ativar `Leaked Password Protection` no Supabase Auth, se suportado pelo plano, ou registrar formalmente a limitação de plano e uma mitigação equivalente.

As pendências de `citext` e do Performance Advisor ficam versionadas como hardening posterior e não devem ser alteradas em produção sem teste de impacto.
