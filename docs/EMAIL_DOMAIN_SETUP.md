# PLUMARELI — e-mails de acesso e domínio público

## E-mails de autenticação

Os templates e textos de autenticação devem apresentar a marca PLUMARELI em assunto, remetente e conteúdo visível ao usuário.

Assuntos sugeridos:
- Primeiro acesso: **Seu acesso ao PLUMARELI está pronto**
- Recuperação de senha: **Redefina sua senha do PLUMARELI**

No Supabase hospedado, configure os templates em **Authentication → Email Templates**. Para o remetente deixar de aparecer com identidade do Supabase, configure **Custom SMTP** com um domínio verificado e nome do remetente `PLUMARELI`.

Não salve senha SMTP no repositório. Mantenha credenciais somente nas configurações seguras do provedor/Supabase.

## Domínio público do site

Fluxo recomendado:

1. registrar ou definir o domínio oficial do PLUMARELI;
2. adicionar o domínio ao projeto na Vercel;
3. configurar os registros DNS solicitados pela Vercel;
4. depois da validação, definir `NEXT_PUBLIC_SITE_URL=https://SEU-DOMINIO-OFICIAL`;
5. configurar `PLUMARELI_APP_ORIGIN=https://SEU-DOMINIO-OFICIAL` nas Edge Functions do Supabase;
6. no Supabase Auth, definir a mesma URL como **Site URL**;
7. adicionar `https://SEU-DOMINIO-OFICIAL/auth/confirm**` às Redirect URLs;
8. manter `http://localhost:3000/**` somente para desenvolvimento quando necessário.

Enquanto não houver domínio próprio, o app também consegue usar o domínio de produção exposto pela Vercel por `VERCEL_PROJECT_PRODUCTION_URL`. Para produção estável, porém, uma URL canônica explícita é preferível.

## Exemplo de organização

Use o domínio que realmente for registrado e verificado. Exemplo apenas de estrutura:

- Site/aplicação: `https://seudominio.com.br`
- E-mail de acesso: `acesso@seudominio.com.br`

Não use exemplos antigos `curioeducacao.*` como configuração de produção do PLUMARELI.

## Supabase e Vercel

O domínio personalizado do **site** e um eventual Custom Domain do **Supabase** são configurações diferentes. Para publicar o PLUMARELI com endereço próprio, o domínio do site pode apontar para a Vercel; um Custom Domain do Supabase é opcional e depende da necessidade/conta.

## Compatibilidade técnica

Algumas Edge Functions ainda têm nomes `curio-*` e reconhecem variáveis antigas como `CURIO_APP_URL` para não quebrar ambientes existentes. Esses nomes são legado técnico e não devem aparecer como marca para o usuário.

Novas configurações devem preferir:

- `PLUMARELI_APP_ORIGIN`
- `PLUMARELI_ALLOW_LOCAL_REDIRECTS` somente em desenvolvimento local, quando necessário.
