PLUMARELI — atualização Família/Aluno + PIN + navegação + Gerador
Data original: 09/08/2026

1. Trabalhe sobre a pasta local do repositório plumareli-web.
2. Preserve o seu .env.local atual.
3. Instale/atualize as dependências quando necessário com: npm install
4. Rode: npm run assets:check
5. Rode: npm run dev
6. Saia e entre novamente no sistema para validar cookies/sessão.

Teste sugerido:
- Família: primeiro acesso exige PIN de 4 números.
- Família: “Espaço da criança” mostra as crianças vinculadas.
- Aluno: “Voltar à família” exige PIN.
- Tentar /dashboard, /familia, /admin ou /professor enquanto está no contexto da criança leva à tela do PIN.
- Sidebar: hover claro; item atual permanece mais escuro.
- Professor > Gerador: o aviso de encType não deve mais aparecer.
- Sons: opção aparece somente no espaço do Aluno.
- Modo de segurança para epilepsia: cards claros permanecem com texto escuro legível.

Banco:
As migrations 010 e 011 já foram aplicadas no Supabase conectado; os arquivos permanecem no repositório para manter o histórico alinhado. Não renomear migrations aplicadas apenas por causa da troca de marca.

E-mail/domínio:
Os templates HTML estão em supabase/templates e as instruções em docs/EMAIL_DOMAIN_SETUP.md. A configuração do remetente personalizado depende de domínio + Custom SMTP no Supabase.
