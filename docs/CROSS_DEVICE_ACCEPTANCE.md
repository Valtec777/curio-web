# Matriz de aceite multiplataforma — CURIÓ

Este checklist não substitui teste em dispositivo real. Ele registra o que precisa ser validado antes da publicação em produção.

## Desktop / notebook

- Windows 11: Chrome, Edge e Firefox
- macOS: Safari e Chrome
- Linux: Chrome/Chromium e Firefox

Validar em 1366×768, 1440×900 e larguras menores de notebook:
- login, primeiro acesso e recuperação de senha;
- barra lateral expandida/recolhida sem scroll horizontal;
- ícones inteiros, sem quadrado branco e com contraste suficiente;
- formulários, uploads, PDF, chats e modais;
- agenda e links externos/Meet;
- Admin, Professor, Família e Aluno.

## Tablet

- iPadOS / Safari
- Android tablet / Chrome

Validar orientação vertical e horizontal:
- menu móvel;
- tabelas e cards sem corte;
- filtros e formulários utilizáveis por toque;
- PDFs e anexos abrindo sem exigir zoom lateral excessivo.

## Celular

- iPhone / Safari
- Android / Chrome

Validar:
- login e links recebidos por e-mail;
- menu/side drawer;
- troca de filho na Família;
- ações principais em uma coluna;
- upload por câmera/galeria e PDF;
- chats;
- Missão Cuca;
- Meu Caderno;
- Agenda/Meet;
- acessibilidade e tamanho de toque.

## Fluxo crítico de convite

Em cada sistema disponível para teste:
1. reenviar convite para uma conta de teste;
2. abrir o e-mail em uma sessão sem login no CURIÓ;
3. confirmar que o link é HTTPS e não contém `localhost`;
4. definir senha;
5. entrar no portal correto;
6. fechar e abrir novamente para confirmar persistência normal da sessão;
7. repetir em janela privada/anônima.

## Critério de aprovação

Um perfil só deve ser considerado aprovado para produção quando os fluxos críticos tiverem sido testados visualmente e autenticados em pelo menos:
- um desktop Windows;
- um desktop/macOS Safari;
- um iPhone/Safari;
- um Android/Chrome;
- um tablet ou emulação equivalente, seguida de ao menos um teste real quando disponível.

O CI atual (`typecheck` + `build`) comprova compilação, não compatibilidade visual física entre dispositivos.
