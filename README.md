# CURIÓ v1 — Fundação funcional

Esta entrega é uma primeira base executável do novo CURIÓ.

## Implementado

- landing page;
- login e cadastro da família;
- Supabase Auth com SSR/cookies;
- multipapel: admin, teacher, student e guardian;
- proteção por papel no servidor;
- PostgreSQL + RLS;
- cadastro de alunos;
- vínculos professor → aluno e família → aluno;
- dashboard do professor;
- Missão Cuca com habilidade canônica;
- publicação para aluno;
- resposta do aluno;
- correção humana;
- evidência pedagógica;
- domínio, autonomia, confiança e tendência;
- histórico da habilidade;
- Ninho da Família com progresso agregado.

## Stack

- Next.js 16 / App Router
- React + TypeScript
- Supabase Auth
- PostgreSQL / Supabase
- CSS nativo

## Instalação

Use Node.js 20.9 ou superior.

1. Crie um projeto no Supabase.
2. Copie `.env.example` para `.env.local`.
3. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. No SQL Editor, execute:
   - `supabase/migrations/001_curio_core.sql`
   - `supabase/migrations/002_curio_rls.sql`
   - `supabase/migrations/003_seed_taxonomy.sql`
5. Instale e rode:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.


### Confirmação de e-mail no Supabase

Se a confirmação de e-mail estiver habilitada, ajuste o template **Confirm signup** para usar o endpoint SSR do projeto:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
  Confirmar meu e-mail
</a>
```

Configure também o **Site URL** e os redirects permitidos do Auth para o domínio real da aplicação.

## Primeiro ADMIN

Crie a conta em `/login` e depois execute no SQL Editor:

```sql
select public.bootstrap_admin('seu-email@exemplo.com');
```

## Primeiro PROFESSOR

A pessoa cria a conta e o operador executa:

```sql
select public.bootstrap_teacher('professor@exemplo.com');
```

## Login do ALUNO

O aluno pode existir sem login. Para habilitar o Modo Criança, vincule um usuário Auth:

```sql
update public.students
set auth_user_id = 'UUID-DO-USUARIO-AUTH'
where id = 'UUID-DO-ALUNO';

insert into public.user_roles(user_id, role)
values ('UUID-DO-USUARIO-AUTH', 'student')
on conflict do nothing;
```

## Fluxo vertical

```text
ADMIN cria aluno e vínculos
  ↓
PROFESSOR cria Missão Cuca
  ↓
ALUNO responde
  ↓
PROFESSOR corrige e registra evidência
  ↓
MAPA recalcula domínio/autonomia/confiança
  ↓
FAMÍLIA acompanha o estado agregado
```

## Regra pedagógica inicial

Domínio: 0–4.
Autonomia: 0–4.
Confiança: baixa, média ou alta.
Tendência: melhorando, estável ou precisa de atenção.

O cálculo usa até as 8 evidências mais recentes e dá mais peso às evidências recentes.
Uma única evidência não fecha diagnóstico.

## Próximas fases

- matrícula e planos;
- questionário inicial da família;
- diagnóstico;
- plano de 30 dias;
- Caderno Curió com upload;
- agenda;
- mensagens;
- relatório mensal;
- gamificação;
- PDFs;
- IA com revisão humana;
- financeiro.

## Produção

Antes de usar dados reais de crianças:

- revisar todas as policies RLS;
- configurar redirects do Auth;
- testar os quatro perfis com contas separadas;
- revisar retenção de arquivos e logs;
- revisar consentimentos e privacidade aplicáveis.
