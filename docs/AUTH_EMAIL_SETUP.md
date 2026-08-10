# E-mail de acesso do CURIÓ — configuração de produção

Este documento registra a parte externa que não pode ser concluída apenas pelo código do repositório.

## Estado no código

- Os fluxos de primeiro acesso e recuperação não usam `localhost` quando executados no Vercel.
- A Edge Function `curio-access-admin` rejeita `localhost` em convites de produção/Preview e possui fallback HTTPS seguro.
- Convites e redefinições retornam para `/auth/confirm?next=/definir-senha`.
- O endereço de contato adotado no produto é `curio.educacao@gmail.com`.

## Configuração necessária no Supabase Auth

Em **Authentication → SMTP Settings / Custom SMTP**, configurar um servidor SMTP próprio. O SMTP padrão do Supabase é destinado a desenvolvimento/testes e não deve ser considerado a configuração final de produção.

Configuração desejada:

- Sender name: `CURIÓ`
- Sender email / From: `curio.educacao@gmail.com`
- SMTP host: `smtp.gmail.com` se a conta Gmail for usada diretamente
- SMTP port: `587` com STARTTLS ou `465` com SSL, conforme a configuração escolhida
- SMTP username: `curio.educacao@gmail.com`
- SMTP password: **senha de app**, nunca a senha normal da conta

Para gerar senha de app no Google, a conta precisa ter verificação em duas etapas habilitada. A senha não deve ser colocada no GitHub, no banco ou em arquivo do projeto.

Para uso comercial/produção em escala, avaliar migrar o remetente de autenticação para domínio próprio e provedor dedicado (por exemplo, Resend, Postmark, SES, Brevo ou equivalente) com SPF, DKIM e DMARC configurados.

## URLs de autenticação

No Supabase Auth, revisar:

- **Site URL:** usar o domínio oficial quando ele existir.
- **Redirect URLs:** durante a fase de Preview, incluir o endereço estável da branch de Preview e o callback de autenticação do projeto.
- Remover `localhost` como destino operacional antes do lançamento público. Ele pode permanecer apenas para desenvolvimento local, se necessário.

Preview atual usado no desenvolvimento:

`https://curio-web-crcv-git-codex-estabilizacao-curio-pri-2a2b5b-curio16.vercel.app`

Callback usado pelo app:

`/auth/confirm?next=/definir-senha`

## Templates de e-mail

Personalizar no Supabase Auth os templates de:

- convite/primeiro acesso;
- recuperação de senha;
- confirmação de e-mail, caso seja utilizada.

Manter o texto curto e transacional. Exemplo de assunto:

`Seu acesso ao CURIÓ`

Exemplo de mensagem:

> Seu acesso ao CURIÓ está pronto. Use o botão abaixo para criar sua senha e entrar com segurança. Se você não esperava este e-mail, ignore a mensagem ou fale com a equipe CURIÓ.

Evitar conteúdo promocional, excesso de imagens e vários links no mesmo e-mail de autenticação.

## Teste obrigatório depois da configuração

1. Criar ou reenviar um acesso de teste.
2. Abrir o e-mail fora da sessão do Admin e, de preferência, em outro dispositivo.
3. Confirmar que o link começa em HTTPS e não contém `localhost`.
4. Definir a senha.
5. Fazer login com a nova senha.
6. Repetir em janela anônima e em pelo menos Safari/iOS, Chrome/Android e navegadores desktop.
7. Confirmar que o remetente exibido é `CURIÓ <curio.educacao@gmail.com>` (ou o endereço de domínio próprio escolhido posteriormente).

## Segurança

Também permanece recomendado habilitar **Leaked Password Protection** no Supabase Auth e manter limites de envio compatíveis com uso real.
