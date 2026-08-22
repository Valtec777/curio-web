# PLUMARELI — modo beta privado

O projeto fica em modo beta privado por padrão.

## Comportamento no beta

Quando `PLUMARELI_PUBLIC_LAUNCH` não existe ou é diferente de `true`:

- `/` é reescrito internamente para a porta discreta em `/beta`;
- todas as respostas recebem `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`;
- `/robots.txt` bloqueia o rastreamento de todo o site;
- `/sitemap.xml` não publica URLs;
- `/llms.txt` responde 404;
- solicitações de matrícula sem convite são recusadas;
- códigos de convite são revalidados no servidor antes de gravar uma solicitação.

As áreas autenticadas continuam funcionando normalmente.

## WhatsApp

Para exibir o botão de WhatsApp na porta do beta, configure:

```env
NEXT_PUBLIC_WHATSAPP_URL=https://wa.me/55DDDNUMERO
```

Sem essa variável, o botão simplesmente não aparece.

## Lançamento público futuro

Para restaurar a landing completa e a configuração pública de SEO:

```env
PLUMARELI_PUBLIC_LAUNCH=true
```

Depois de alterar a variável, faça um novo deploy e confira `/robots.txt`, `/sitemap.xml` e a home.

## GitHub

O modo beta reduz a descoberta do site, mas não protege o código-fonte de um repositório público. Enquanto o produto estiver em fase reservada, mantenha o repositório como **Private** nas configurações do GitHub.

## Observação de segurança

`robots.txt`, `noindex` e headers de robôs controlam descoberta por buscadores; eles não são mecanismos de autenticação. Conteúdo realmente privado deve continuar atrás das verificações de papel, sessão e RLS já existentes no projeto.
