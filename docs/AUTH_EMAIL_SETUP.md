# PLUMARELI — configuração de e-mails de acesso

Este documento descreve o fluxo de autenticação atualmente implementado e a configuração necessária para produção.

## Estado atual no código

### Primeiro acesso e recuperação de senha

`app/login/actions.ts` usa um cliente de autenticação sem sessão persistida e chama `resetPasswordForEmail` com retorno para:

`/auth/confirm?next=/definir-senha`

O cliente usa `flowType: "implicit"` nesse handoff de uso único para permitir que a pessoa solicite o e-mail em um navegador e abra o link em outro navegador, aplicativo de e-mail ou dispositivo.

### Acessos enviados pela Administração

Existem duas Edge Functions com nomes técnicos legados:

- `curio-access-control`: reenvio de acesso e atualização de dados de usuários já existentes;
- `curio-access-admin`: convites institucionais, matrículas e preparação de novos acessos.

Esses nomes não devem ser renomeados sem coordenar o deploy e todas as chamadas existentes. A marca exibida ao usuário é PLUMARELI.

Os envios administrativos usam Magic Link/OTP (`signInWithOtp`) e retornam para o mesmo callback:

`/auth/confirm?next=/definir-senha`

## Origem pública do site

O app não possui mais um domínio Curió fixo como fallback de produção.

No Next.js, a origem é resolvida nesta ordem:

1. `NEXT_PUBLIC_SITE_URL` quando configurada com uma URL não local;
2. `VERCEL_PROJECT_PRODUCTION_URL`;
3. `VERCEL_BRANCH_URL`;
4. `VERCEL_URL`;
5. URL local configurada para desenvolvimento/CI;
6. `http://localhost:3000` como último fallback local.

Para produção com domínio próprio, configure `NEXT_PUBLIC_SITE_URL` com a URL canônica do PLUMARELI.

## Edge Functions do Supabase

Para tornar o domínio explícito e impedir redirects para origens inesperadas, configure como segredo/variável das funções:

`PLUMARELI_APP_ORIGIN=https://SEU-DOMINIO-OFICIAL`

Durante a migração, o código ainda reconhece `CURIO_APP_URL` e `CURIO_APP_ORIGIN` como nomes legados. Prefira `PLUMARELI_APP_ORIGIN` em novas configurações.

Desenvolvimento local pode ser autorizado explicitamente com:

`PLUMARELI_ALLOW_LOCAL_REDIRECTS=true`

O nome legado `CURIO_ALLOW_LOCAL_REDIRECTS=true` continua aceito por compatibilidade. Não habilite redirect local em produção.

## URLs no Supabase Auth

Em **Supabase → Authentication → URL Configuration**:

- **Site URL:** use a URL oficial do PLUMARELI;
- **Redirect URLs:** inclua `https://SEU-DOMINIO-OFICIAL/auth/confirm**`;
- mantenha `http://localhost:3000/**` apenas quando necessário para desenvolvimento local.

Se o domínio oficial mudar, atualize `NEXT_PUBLIC_SITE_URL`, `PLUMARELI_APP_ORIGIN` e a configuração de URLs do Supabase de forma coordenada.

## Custom SMTP

Para produção, configure **Custom SMTP** no Supabase Auth com um remetente verificado. Recomendações:

- Sender name: `PLUMARELI`;
- Sender email: endereço verificado do domínio oficial, por exemplo `acesso@seudominio.com.br`;
- senha SMTP somente nas configurações seguras do provedor/Supabase, nunca no GitHub;
- para escala comercial, use provedor transacional com SPF, DKIM e DMARC corretamente configurados.

## Templates de e-mail

Os textos enviados devem usar PLUMARELI. Assunto sugerido para acesso/recuperação:

`Seu acesso ao PLUMARELI`

O conteúdo deve explicar de forma curta que o botão permite criar ou redefinir a senha e que a mensagem pode ser ignorada caso a pessoa não tenha solicitado o acesso.

## Teste obrigatório

Depois de mudar domínio, SMTP ou templates:

1. solicitar primeiro acesso;
2. abrir o e-mail fora da sessão que iniciou a solicitação;
3. confirmar que o link é HTTPS e aponta para o domínio oficial do PLUMARELI;
4. definir a senha e entrar;
5. testar `Esqueci minha senha`;
6. reenviar um acesso pelo Admin;
7. criar um convite/matrícula de teste pelo Admin;
8. repetir ao menos um fluxo em janela anônima ou outro dispositivo;
9. confirmar que nenhum link contém domínio Curió antigo ou `localhost` em produção.

## Segurança

Também é recomendado habilitar **Leaked Password Protection** no Supabase Auth e manter limites de envio compatíveis com o uso real.
