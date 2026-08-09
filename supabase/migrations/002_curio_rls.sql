-- CURIÓ v1 — Row Level Security
-- Segurança também no banco, não apenas na interface.

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.teachers enable row level security;
alter table public.guardians enable row level security;
alter table public.grades enable row level security;
alter table public.students enable row level security;
alter table public.teacher_students enable row level security;
alter table public.guardian_students enable row level security;
alter table public.subjects enable row level security;
alter table public.contents enable row level security;
alter table public.skills enable row level security;
alter table public.missions enable row level security;
alter table public.mission_questions enable row level security;
alter table public.mission_students enable row level security;
alter table public.submissions enable row level security;
alter table public.answers enable row level security;
alter table public.pedagogical_evidence enable row level security;
alter table public.student_skill_states enable row level security;
alter table public.student_skill_state_history enable row level security;
alter table public.interventions enable row level security;

-- Perfis e papéis
create policy "profiles_select"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or private.has_role('admin')
);

create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "roles_select"
on public.user_roles for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_role('admin')
);

create policy "roles_admin_insert"
on public.user_roles for insert to authenticated
with check (private.has_role('admin'));

create policy "roles_admin_update"
on public.user_roles for update to authenticated
using (private.has_role('admin'))
with check (private.has_role('admin'));

create policy "roles_admin_delete"
on public.user_roles for delete to authenticated
using (private.has_role('admin'));

-- Professores e responsáveis
create policy "teachers_select"
on public.teachers for select to authenticated
using (
  private.has_role('admin')
  or profile_id = (select auth.uid())
);

create policy "teachers_admin_insert"
on public.teachers for insert to authenticated
with check (private.has_role('admin'));

create policy "teachers_admin_update"
on public.teachers for update to authenticated
using (private.has_role('admin'))
with check (private.has_role('admin'));

create policy "teachers_admin_delete"
on public.teachers for delete to authenticated
using (private.has_role('admin'));

create policy "guardians_select"
on public.guardians for select to authenticated
using (
  private.has_role('admin')
  or profile_id = (select auth.uid())
);

create policy "guardians_admin_insert"
on public.guardians for insert to authenticated
with check (private.has_role('admin'));

create policy "guardians_admin_update"
on public.guardians for update to authenticated
using (private.has_role('admin'))
with check (private.has_role('admin'));

create policy "guardians_admin_delete"
on public.guardians for delete to authenticated
using (private.has_role('admin'));

-- Catálogos
create policy "grades_read"
on public.grades for select to authenticated
using (true);

create policy "grades_admin_insert"
on public.grades for insert to authenticated
with check (private.has_role('admin'));

create policy "grades_admin_update"
on public.grades for update to authenticated
using (private.has_role('admin'))
with check (private.has_role('admin'));

create policy "grades_admin_delete"
on public.grades for delete to authenticated
using (private.has_role('admin'));

create policy "subjects_read"
on public.subjects for select to authenticated
using (true);

create policy "subjects_admin_insert"
on public.subjects for insert to authenticated
with check (private.has_role('admin'));

create policy "subjects_admin_update"
on public.subjects for update to authenticated
using (private.has_role('admin'))
with check (private.has_role('admin'));

create policy "subjects_admin_delete"
on public.subjects for delete to authenticated
using (private.has_role('admin'));

create policy "contents_read"
on public.contents for select to authenticated
using (true);

create policy "contents_admin_insert"
on public.contents for insert to authenticated
with check (private.has_role('admin'));

create policy "contents_admin_update"
on public.contents for update to authenticated
using (private.has_role('admin'))
with check (private.has_role('admin'));

create policy "contents_admin_delete"
on public.contents for delete to authenticated
using (private.has_role('admin'));

create policy "skills_read"
on public.skills for select to authenticated
using (true);

create policy "skills_admin_insert"
on public.skills for insert to authenticated
with check (private.has_role('admin'));

create policy "skills_admin_update"
on public.skills for update to authenticated
using (private.has_role('admin'))
with check (private.has_role('admin'));

create policy "skills_admin_delete"
on public.skills for delete to authenticated
using (private.has_role('admin'));

-- Alunos
create policy "students_select"
on public.students for select to authenticated
using (
  private.has_role('admin')
  or auth_user_id = (select auth.uid())
  or private.teacher_has_student(id)
  or private.guardian_has_student(id)
);

create policy "students_admin_insert"
on public.students for insert to authenticated
with check (private.has_role('admin'));

create policy "students_admin_update"
on public.students for update to authenticated
using (private.has_role('admin'))
with check (private.has_role('admin'));

create policy "students_admin_delete"
on public.students for delete to authenticated
using (private.has_role('admin'));

-- Vínculos
create policy "teacher_students_select"
on public.teacher_students for select to authenticated
using (
  private.has_role('admin')
  or teacher_id = private.teacher_id_for_user()
  or student_id in (
    select s.id
    from public.students s
    where s.auth_user_id = (select auth.uid())
  )
);

create policy "teacher_students_admin_insert"
on public.teacher_students for insert to authenticated
with check (private.has_role('admin'));

create policy "teacher_students_admin_update"
on public.teacher_students for update to authenticated
using (private.has_role('admin'))
with check (private.has_role('admin'));

create policy "teacher_students_admin_delete"
on public.teacher_students for delete to authenticated
using (private.has_role('admin'));

create policy "guardian_students_select"
on public.guardian_students for select to authenticated
using (
  private.has_role('admin')
  or guardian_id = private.guardian_id_for_user()
  or student_id in (
    select s.id
    from public.students s
    where s.auth_user_id = (select auth.uid())
  )
);

create policy "guardian_students_admin_insert"
on public.guardian_students for insert to authenticated
with check (private.has_role('admin'));

create policy "guardian_students_admin_update"
on public.guardian_students for update to authenticated
using (private.has_role('admin'))
with check (private.has_role('admin'));

create policy "guardian_students_admin_delete"
on public.guardian_students for delete to authenticated
using (private.has_role('admin'));

-- Missões
create policy "missions_select"
on public.missions for select to authenticated
using (
  private.has_role('admin')
  or created_by_teacher_id = private.teacher_id_for_user()
  or exists (
    select 1
    from public.mission_students ms
    where ms.mission_id = id
      and (
        ms.student_id in (
          select s.id
          from public.students s
          where s.auth_user_id = (select auth.uid())
        )
        or private.guardian_has_student(ms.student_id)
      )
  )
);

create policy "missions_teacher_insert"
on public.missions for insert to authenticated
with check (
  private.has_role('admin')
  or created_by_teacher_id = private.teacher_id_for_user()
);

create policy "missions_teacher_update"
on public.missions for update to authenticated
using (
  private.has_role('admin')
  or created_by_teacher_id = private.teacher_id_for_user()
)
with check (
  private.has_role('admin')
  or created_by_teacher_id = private.teacher_id_for_user()
);

create policy "missions_teacher_delete"
on public.missions for delete to authenticated
using (
  private.has_role('admin')
  or (
    created_by_teacher_id = private.teacher_id_for_user()
    and status = 'draft'
  )
);

-- Questões das missões
create policy "questions_select"
on public.mission_questions for select to authenticated
using (
  exists (
    select 1
    from public.missions m
    where m.id = mission_id
      and (
        private.has_role('admin')
        or m.created_by_teacher_id = private.teacher_id_for_user()
        or exists (
          select 1
          from public.mission_students ms
          where ms.mission_id = m.id
            and (
              ms.student_id in (
                select s.id
                from public.students s
                where s.auth_user_id = (select auth.uid())
              )
              or private.guardian_has_student(ms.student_id)
            )
        )
      )
  )
);

create policy "questions_teacher_insert"
on public.mission_questions for insert to authenticated
with check (
  exists (
    select 1 from public.missions m
    where m.id = mission_id
      and (
        private.has_role('admin')
        or m.created_by_teacher_id = private.teacher_id_for_user()
      )
  )
);

create policy "questions_teacher_update"
on public.mission_questions for update to authenticated
using (
  exists (
    select 1 from public.missions m
    where m.id = mission_id
      and (
        private.has_role('admin')
        or m.created_by_teacher_id = private.teacher_id_for_user()
      )
  )
)
with check (
  exists (
    select 1 from public.missions m
    where m.id = mission_id
      and (
        private.has_role('admin')
        or m.created_by_teacher_id = private.teacher_id_for_user()
      )
  )
);

create policy "questions_teacher_delete"
on public.mission_questions for delete to authenticated
using (
  exists (
    select 1 from public.missions m
    where m.id = mission_id
      and (
        private.has_role('admin')
        or m.created_by_teacher_id = private.teacher_id_for_user()
      )
  )
);

-- Atribuições
create policy "mission_students_select"
on public.mission_students for select to authenticated
using (
  private.has_role('admin')
  or assigned_by_teacher_id = private.teacher_id_for_user()
  or student_id in (
    select s.id
    from public.students s
    where s.auth_user_id = (select auth.uid())
  )
  or private.guardian_has_student(student_id)
);

-- Alterações em mission_students são feitas por RPC/trigger protegidos.
-- Não existe policy direta de INSERT/UPDATE para authenticated.

-- Submissões
create policy "submissions_select"
on public.submissions for select to authenticated
using (
  private.has_role('admin')
  or private.teacher_has_student(student_id)
  or student_id in (
    select s.id
    from public.students s
    where s.auth_user_id = (select auth.uid())
  )
);

create policy "submissions_student_insert"
on public.submissions for insert to authenticated
with check (
  student_id in (
    select s.id
    from public.students s
    where s.auth_user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.mission_students ms
    where ms.id = mission_student_id
      and ms.student_id = student_id
      and ms.status in ('assigned', 'in_progress')
  )
);

create policy "submissions_teacher_update"
on public.submissions for update to authenticated
using (
  private.has_role('admin')
  or private.teacher_has_student(student_id)
)
with check (
  private.has_role('admin')
  or private.teacher_has_student(student_id)
);

create policy "submissions_student_delete_pending"
on public.submissions for delete to authenticated
using (
  student_id in (
    select s.id
    from public.students s
    where s.auth_user_id = (select auth.uid())
  )
  and review_status = 'pending'
);

-- Respostas
create policy "answers_select"
on public.answers for select to authenticated
using (
  exists (
    select 1
    from public.submissions sub
    where sub.id = submission_id
      and (
        private.has_role('admin')
        or private.teacher_has_student(sub.student_id)
        or sub.student_id in (
          select s.id
          from public.students s
          where s.auth_user_id = (select auth.uid())
        )
      )
  )
);

create policy "answers_student_insert"
on public.answers for insert to authenticated
with check (
  exists (
    select 1
    from public.submissions sub
    where sub.id = submission_id
      and sub.student_id in (
        select s.id
        from public.students s
        where s.auth_user_id = (select auth.uid())
      )
  )
);

create policy "answers_teacher_update"
on public.answers for update to authenticated
using (
  exists (
    select 1
    from public.submissions sub
    where sub.id = submission_id
      and (
        private.has_role('admin')
        or private.teacher_has_student(sub.student_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.submissions sub
    where sub.id = submission_id
      and (
        private.has_role('admin')
        or private.teacher_has_student(sub.student_id)
      )
  )
);

-- Evidência bruta: equipe pedagógica apenas.
create policy "evidence_select"
on public.pedagogical_evidence for select to authenticated
using (
  private.has_role('admin')
  or private.teacher_has_student(student_id)
);

create policy "evidence_teacher_insert"
on public.pedagogical_evidence for insert to authenticated
with check (
  private.has_role('admin')
  or (
    teacher_id = private.teacher_id_for_user()
    and private.teacher_has_student(student_id)
  )
);

create policy "evidence_teacher_update"
on public.pedagogical_evidence for update to authenticated
using (
  private.has_role('admin')
  or (
    teacher_id = private.teacher_id_for_user()
    and private.teacher_has_student(student_id)
  )
)
with check (
  private.has_role('admin')
  or (
    teacher_id = private.teacher_id_for_user()
    and private.teacher_has_student(student_id)
  )
);

-- Estado agregado: visível para equipe, aluno e família autorizada.
create policy "skill_states_select"
on public.student_skill_states for select to authenticated
using (
  private.has_role('admin')
  or private.teacher_has_student(student_id)
  or private.guardian_can_view_progress(student_id)
  or student_id in (
    select s.id
    from public.students s
    where s.auth_user_id = (select auth.uid())
  )
);

create policy "history_select"
on public.student_skill_state_history for select to authenticated
using (
  private.has_role('admin')
  or private.teacher_has_student(student_id)
  or private.guardian_can_view_progress(student_id)
  or student_id in (
    select s.id
    from public.students s
    where s.auth_user_id = (select auth.uid())
  )
);

-- Intervenções são internas.
create policy "interventions_select"
on public.interventions for select to authenticated
using (
  private.has_role('admin')
  or private.teacher_has_student(student_id)
);

create policy "interventions_teacher_insert"
on public.interventions for insert to authenticated
with check (
  private.has_role('admin')
  or (
    teacher_id = private.teacher_id_for_user()
    and private.teacher_has_student(student_id)
  )
);

create policy "interventions_teacher_update"
on public.interventions for update to authenticated
using (
  private.has_role('admin')
  or (
    teacher_id = private.teacher_id_for_user()
    and private.teacher_has_student(student_id)
  )
)
with check (
  private.has_role('admin')
  or (
    teacher_id = private.teacher_id_for_user()
    and private.teacher_has_student(student_id)
  )
);

create policy "interventions_teacher_delete"
on public.interventions for delete to authenticated
using (
  private.has_role('admin')
  or (
    teacher_id = private.teacher_id_for_user()
    and private.teacher_has_student(student_id)
  )
);
