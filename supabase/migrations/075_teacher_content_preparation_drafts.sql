-- CURIÓ · rascunhos editáveis para preparação de conteúdo do Professor

create table if not exists public.content_preparation_drafts (
  id uuid primary key default gen_random_uuid(),
  created_by_teacher_id uuid not null references public.teachers(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  source_kind text not null default 'text' check (source_kind in ('text','file','mixed')),
  source_text text,
  source_file_path text,
  source_file_name text,
  source_mime_type text,
  subject_id uuid references public.subjects(id) on delete set null,
  grade_id uuid references public.grades(id) on delete set null,
  theme text,
  objective text,
  skill_text text,
  age_label text,
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  desired_question_count integer not null default 10 check (desired_question_count between 0 and 50),
  question_types text[] not null default '{}'::text[],
  target_formats text[] not null default '{}'::text[],
  notes text,
  estimated_minutes integer not null default 20 check (estimated_minutes between 1 and 300),
  status text not null default 'draft' check (status in ('draft','review','converted','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_preparation_questions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.content_preparation_drafts(id) on delete cascade,
  position integer not null check (position > 0),
  question_type text not null default 'open_text' check (question_type in ('multiple_choice','true_false','open_text','matching','fill_blank','ordering','interpretation','problem')),
  prompt text not null default '',
  options jsonb not null default '[]'::jsonb,
  correct_value text,
  explanation text,
  hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(draft_id, position)
);

create index if not exists content_preparation_drafts_teacher_idx on public.content_preparation_drafts(created_by_teacher_id, updated_at desc);
create index if not exists content_preparation_questions_draft_idx on public.content_preparation_questions(draft_id, position);

alter table public.content_preparation_drafts enable row level security;
alter table public.content_preparation_questions enable row level security;

drop policy if exists content_preparation_drafts_owner on public.content_preparation_drafts;
create policy content_preparation_drafts_owner on public.content_preparation_drafts for all to authenticated
using (private.has_role('admin'::app_role) or created_by_teacher_id=private.teacher_id_for_user())
with check (private.has_role('admin'::app_role) or created_by_teacher_id=private.teacher_id_for_user());

drop policy if exists content_preparation_questions_owner on public.content_preparation_questions;
create policy content_preparation_questions_owner on public.content_preparation_questions for all to authenticated
using (
  private.has_role('admin'::app_role)
  or exists(select 1 from public.content_preparation_drafts d where d.id=draft_id and d.created_by_teacher_id=private.teacher_id_for_user())
)
with check (
  private.has_role('admin'::app_role)
  or exists(select 1 from public.content_preparation_drafts d where d.id=draft_id and d.created_by_teacher_id=private.teacher_id_for_user())
);
