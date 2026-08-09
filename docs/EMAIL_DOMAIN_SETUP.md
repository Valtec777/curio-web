# CURIÓ — e-mails de acesso e domínio público

## E-mails de autenticação

Os arquivos `supabase/templates/invite.html` e `supabase/templates/recovery.html` são os modelos visuais de primeiro acesso e recuperação de senha.

Assuntos sugeridos:
- Convite / primeiro acesso: **Seu acesso ao CURIÓ está pronto**
- Recuperação de senha: **Redefina sua senha do CURIÓ**

No Supabase hospedado, configurar em **Authentication → Email Templates**. Para o remetente deixar de aparecer com identidade do Supabase, configurar **Custom SMTP** com um domínio verificado, por exemplo `acesso@seudominio.com.br`, e nome do remetente `CURIÓ`.

Não salvar senha SMTP no repositório. Manter credenciais somente nas configurações seguras do provedor/Supabase.

## Domínio público do site

Fluxo recomendado:
1. Registrar/comprar um domínio.
2. Fazer deploy do Next.js na Vercel.
3. Em Vercel → Project → Settings → Domains, adicionar o domínio.
4. Configurar os registros DNS indicados pela Vercel no registrador do domínio.
5. Depois da validação, usar esse domínio como URL pública principal.
6. No Supabase → Authentication → URL Configuration, trocar o **Site URL** para a URL oficial e manter `http://localhost:3000/**` apenas para desenvolvimento.
7. Adicionar rotas de callback/recuperação necessárias à lista de Redirect URLs.

Exemplo de organização (apenas exemplo; disponibilidade do domínio não foi verificada):
- Site/aplicação: `https://curioeducacao.com.br`
- E-mail de acesso: `acesso@curioeducacao.com.br`
- Opcional no futuro: subdomínio de API/Auth próprio do Supabase, se houver necessidade e plano compatível.

O domínio personalizado do **site** e o Custom Domain do **Supabase** são coisas diferentes. Para publicar o Curió com endereço próprio, basta o domínio apontando para a Vercel; o Custom Domain do Supabase é opcional.
