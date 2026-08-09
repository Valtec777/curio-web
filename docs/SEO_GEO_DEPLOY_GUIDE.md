# CURIÓ — SEO, GEO e publicação pública

## O que já foi preparado no código
- metadata do Next.js com título, descrição, canonical, Open Graph e Twitter Card;
- palavras e temas principais coerentes com o conteúdo real da landing;
- JSON-LD com EducationalOrganization, Service e FAQPage;
- `app/robots.ts`;
- `app/sitemap.ts`;
- áreas privadas com `noindex` e bloqueio de rastreamento;
- `public/llms.txt` como arquivo informativo experimental para agentes que decidirem utilizá-lo;
- e-mail oficial exibido: `curio.educacao@gmail.com`.

## Observação sobre GEO
GEO (otimização para respostas de IA) não é um botão que garanta recomendação. A melhor base é: conteúdo público claro e original, identidade consistente, páginas rastreáveis, dados estruturados corretos e informações confiáveis sobre o serviço.

## Publicar gratuitamente primeiro
1. Colocar o código em um repositório Git (GitHub é a opção mais simples).
2. Não enviar `.env.local`, `.next` ou `node_modules` ao repositório.
3. Criar conta gratuita na Vercel e importar o repositório.
4. Configurar as variáveis do Supabase no projeto Vercel.
5. Definir `NEXT_PUBLIC_SITE_URL` com a URL `https://seu-projeto.vercel.app` gerada pela Vercel.
6. Fazer o deploy.
7. No Supabase Auth, trocar Site URL e Redirect URLs para o endereço público.
8. Testar primeiro acesso, recuperação de senha e os quatro portais.
9. Abrir `/robots.txt` e `/sitemap.xml` no domínio publicado e confirmar que respondem.
10. Adicionar o endereço no Google Search Console e enviar `/sitemap.xml`.

## Quando comprar domínio
Depois, adicionar o domínio próprio no projeto Vercel e atualizar:
- `NEXT_PUBLIC_SITE_URL`;
- Site URL do Supabase Auth;
- Redirect URLs do Supabase;
- SMTP/remetente dos e-mails;
- propriedade no Search Console.
