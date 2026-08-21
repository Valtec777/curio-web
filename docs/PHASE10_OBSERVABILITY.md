# Fase 10 — observabilidade e pós-go-live

## Objetivo

Deixar a release preparada para detectar regressões públicas rapidamente depois que o go-live for autorizado, sem adicionar terceiros, sem armazenar PII em telemetria e sem contornar os gates de segurança da Fase 9.

Esta fase **não promove produção** e não altera o estado NO-GO causado pelo `Leaked Password Protection` indisponível no plano Supabase atual.

## Baseline implementada

### 1. Logs estruturados do funil público

A server action do primeiro contato passa a emitir JSON estruturado para os Runtime Logs da Vercel:

- `msg: public_lead`;
- `outcome: rejected_validation`;
- `outcome: grade_lookup_failed`;
- `outcome: insert_failed`;
- `outcome: duplicate_accepted`;
- `outcome: created`;
- duração em `ms`;
- `privacy: no_pii`.

Os logs não incluem nome, telefone, e-mail, nome da criança, dificuldades, mensagem nem código de indicação. Em erros de banco, somente o código técnico do erro é registrado.

A rota `/api/public-events` continua emitindo `public_analytics` com eventos enumerados, path público e placement limitado, também marcado como `privacy: no_pii`.

### 2. Monitor sintético

`scripts/synthetic-monitor.mjs` faz uma verificação externa do ambiente informado e falha em até 10 segundos por request quando um requisito crítico não é atendido.

Checks atuais:

- `/` responde com sucesso e contém a proposta de valor atual;
- `/login` responde com sucesso e contém o título atual;
- headers `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` e CSP com `frame-ancestors 'none'`;
- `/robots.txt` continua protegendo áreas autenticadas e `/api/`;
- `/sitemap.xml` continua anunciando as duas páginas de privacidade.

Latência acima de 5 s gera warning estruturado; timeout/erro funcional gera falha do monitor. O monitor não submete formulário, não cria lead e não envia evento de conversão, portanto não polui métricas do funil.

Execução manual:

```bash
MONITOR_TARGET_URL="https://seu-ambiente.exemplo" npm run synthetic:monitor
```

### 3. Workflow agendável

`.github/workflows/synthetic-monitoring.yml` suporta:

- execução manual contra qualquer URL HTTPS informada;
- agenda a cada 30 minutos;
- em execução agendada, usa a repository variable `MONITOR_TARGET_URL`;
- se a variável não estiver definida, o job agendado fica skipped em vez de gerar falso alerta.

Importante: workflows `schedule` do GitHub executam a versão presente na branch padrão. Portanto o monitor recorrente só fica operacional depois que esta mudança fizer parte da linha de produção/default branch e `MONITOR_TARGET_URL` estiver configurada para o domínio final.

### 4. Go-live integrado ao monitor

O workflow `Go-live readiness gate` agora executa o monitor sintético contra `target_url` antes da suíte autenticada. Assim, o gate estrito exige simultaneamente:

1. contratos estáticos;
2. saúde pública da URL candidata;
3. typecheck;
4. quatro logins reais sem skips;
5. confirmações operacionais da Fase 9.

## Consultas operacionais na Vercel

Nos Runtime Logs, os dois sinais públicos principais são:

- `public_lead` — resultado do envio real do formulário sem PII;
- `public_analytics` — view/CTA/submit/success/login sem valores de formulário.

Sinais que justificam investigação imediata:

- aumento de `grade_lookup_failed` ou `insert_failed`;
- ausência prolongada de `created` enquanto existem `lead_form_submit`;
- falha recorrente do monitor sintético;
- picos de latência do monitor acima de 5 s;
- 5xx ou erros de Auth no mesmo intervalo.

Não usar conteúdo de formulário, e-mail, telefone ou dados de estudante como dimensão de log/monitoramento.

## Critérios pós-corte

Após uma futura promoção autorizada:

- configurar `MONITOR_TARGET_URL` com o domínio final HTTPS;
- confirmar primeira execução manual verde;
- repetir o gate autenticado da Fase 9 contra a URL final;
- acompanhar Runtime Logs por `public_lead` e erros 5xx;
- tratar duas falhas sintéticas consecutivas ou falha de login de papel como critério de rollback/investigação imediata;
- manter o último deployment conhecido como bom registrado no runbook da Fase 9.

## O que não foi adicionado

- Sentry, Datadog, Checkly ou outro SaaS de observabilidade;
- Log Drains, pois exigem plano Vercel compatível e um destino externo;
- Web Analytics/Speed Insights adicionais via pacote, para não expandir dependências nesta fase;
- gravação de eventos de monitoramento no Supabase;
- endpoints públicos extras de health que aumentariam superfície de ataque.

A baseline usa somente Runtime Logs existentes, GitHub Actions e `fetch` nativo do Node 22.
