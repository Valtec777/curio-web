# E-mail de acesso do CURIÓ — configuração de produção

Este documento registra o estado atual do fluxo de autenticação e a única dependência externa que ainda exige credenciais de um provedor de e-mail.

## Estado atual no código

- **Primeiro acesso** usa Magic Link/OTP (`signInWithOtp`) com `shouldCreateUser: false`.
- **Esqueci minha senha** usa o mesmo fluxo Magic Link/OTP e não depende mais de `/recover`.
- **Convite e reenvio pelo Admin** usam a Edge Function `curio-access-admin` versão 7, que prepara/cria o usuário e envia Magic Link/OTP.
- O fluxo administrativo não usa mais `resetPasswordForEmail` nem `inviteUserByEmail` para entrega do acesso.
- Todos os links retornam para `/auth/confirm?next=/definir-senha`.
- O domínio de produção usado pelo fluxo é `https://curio-web-nu.vercel.app`.
- `localhost` só é aceito na Edge Function quando `CURIO_ALLOW_LOCAL_REDIRECTS=true`.

Essa mudança separa o acesso inicial/redefinição do bucket de limite do endpoint `/recover`, que foi o responsável pelos erros HTTP 429 observados em produção.

## SMTP próprio — acabamento de produção

Mesmo com o fluxo Magic Link/OTP funcionando, o recomendado para produção é configurar **Custom SMTP** no Supabase Auth para ter melhor entregabilidade, remetente confiável e controle de volume.

Em **Supabase → Authentication → SMTP Settings / Custom SMTP**, configurar um servidor SMTP próprio.

Configuração possível usando a conta atual:

- Sender name: `CURIÓ`
- Sender email / From: `curio.educacao@gmail.com`
- SMTP host: `smtp.gmail.com`
- SMTP port: `587` com STARTTLS ou `465` com SSL
- SMTP username: `curio.educacao@gmail.com`
- SMTP password: **senha de app**, nunca a senha normal da conta

Para gerar senha de app no Google, a conta precisa ter verificação em duas etapas habilitada. A senha de app não deve ser colocada no GitHub, no banco nem em arquivo do projeto.

Para uso comercial em escala, é preferível um domínio próprio e um provedor transacional dedicado (por exemplo, Resend, Postmark, SES ou Brevo), com SPF, DKIM e DMARC configurados.

## URLs de autenticação

No Supabase Auth, revisar:

- **Site URL:** `https://curio-web-nu.vercel.app` enquanto este for o domínio oficial.
- **Redirect URLs:** incluir `https://curio-web-nu.vercel.app/auth/confirm**` e, se necessário, `https://curio-web-nu.vercel.app/definir-senha**`.
- `localhost` deve permanecer apenas para desenvolvimento local.

Callback usado pelo app:

`/auth/confirm?next=/definir-senha`

## Templates de e-mail

Personalizar no Supabase Auth principalmente o template de **Magic Link**, pois ele é o template usado pelos fluxos atuais de primeiro acesso, redefinição e reenvio administrativo.

Assunto sugerido:

`Seu acesso ao CURIÓ`

Mensagem sugerida:

> Seu acesso ao CURIÓ está pronto. Use o botão abaixo para criar ou redefinir sua senha e entrar com segurança. Se você não esperava este e-mail, ignore a mensagem ou fale com a equipe CURIÓ.

Manter o e-mail curto e transacional, sem excesso de imagens ou vários links.

## Teste obrigatório depois do SMTP

1. Criar ou reenviar um acesso de teste.
2. Abrir o e-mail fora da sessão do Admin e, de preferência, em outro dispositivo.
3. Confirmar que o link começa em HTTPS e não contém `localhost`.
4. Definir a senha.
5. Fazer login com a nova senha.
6. Testar também `Esqueci minha senha`.
7. Repetir em janela anônima e em pelo menos um navegador móvel e um desktop.
8. Confirmar o remetente exibido como `CURIÓ <curio.educacao@gmail.com>` ou o endereço de domínio próprio escolhido.

## Segurança

Também permanece recomendado habilitar **Leaked Password Protection** no Supabase Auth e manter os limites de envio compatíveis com o uso real.
