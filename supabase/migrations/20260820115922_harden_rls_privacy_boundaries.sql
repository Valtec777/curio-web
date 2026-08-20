-- PLUMARELI security hardening: tighten public inserts and ownership checks.

revoke select, update, delete on table public.enrollment_requests from anon;
grant insert on table public.enrollment_requests to anon;

drop policy if exists enrollment_public_insert on public.enrollment_requests;
create policy enrollment_public_insert
on public.enrollment_requests
for insert
to anon, authenticated
with check (
  consent_contact = true
  and status = 'new'
  and assigned_to_teacher_id is null
  and deleted_at is null
  and deleted_by_user_id is null
  and delete_reason is null
  and char_length(btrim(guardian_name)) between 2 and 120
  and char_length(btrim(phone_whatsapp)) between 8 and 40
  and char_length(email::text) <= 320
  and (child_name is null or char_length(btrim(child_name)) between 1 and 120)
  and (child_age is null or child_age between 5 and 18)
  and coalesce(cardinality(subjects), 0) <= 12
  and (main_difficulties is null or char_length(main_difficulties) <= 2000)
  and (message is null or char_length(message) <= 3000)
  and (referral_code is null or referral_code ~ '^[A-Za-z0-9]{6,24}$')
);

drop policy if exists payment_receipts_insert on public.payment_receipts;
create policy payment_receipts_insert
on public.payment_receipts
for insert
to authenticated
with check (
  submitted_by_user_id = (select auth.uid())
  and guardian_id = private.guardian_id_for_user()
  and exists (
    select 1
    from public.payments p
    join public.subscriptions s on s.id = p.subscription_id
    where p.id = payment_receipts.payment_id
      and s.guardian_id = payment_receipts.guardian_id
      and s.status in ('pending', 'active', 'paused')
  )
);

drop policy if exists assessment_answers_student_insert on public.assessment_answers;
create policy assessment_answers_student_insert
on public.assessment_answers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.assessment_students ast
    where ast.id = assessment_answers.assessment_student_id
      and (
        private.has_role('admin'::public.app_role)
        or private.teacher_has_student(ast.student_id)
        or exists (
          select 1
          from public.students s
          where s.id = ast.student_id
            and s.auth_user_id = (select auth.uid())
            and s.deleted_at is null
        )
      )
  )
);

drop policy if exists assessment_answers_team_update on public.assessment_answers;
create policy assessment_answers_team_update
on public.assessment_answers
for update
to authenticated
using (
  exists (
    select 1
    from public.assessment_students ast
    where ast.id = assessment_answers.assessment_student_id
      and (
        private.has_role('admin'::public.app_role)
        or private.teacher_has_student(ast.student_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.assessment_students ast
    where ast.id = assessment_answers.assessment_student_id
      and (
        private.has_role('admin'::public.app_role)
        or private.teacher_has_student(ast.student_id)
      )
  )
);

drop policy if exists quiz_attempts_student_insert on public.quiz_attempts;
create policy quiz_attempts_student_insert
on public.quiz_attempts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.quiz_students qs
    where qs.id = quiz_attempts.quiz_student_id
      and (
        private.has_role('admin'::public.app_role)
        or private.teacher_has_student(qs.student_id)
        or exists (
          select 1
          from public.students s
          where s.id = qs.student_id
            and s.auth_user_id = (select auth.uid())
            and s.deleted_at is null
        )
      )
  )
);

drop policy if exists quiz_attempts_team_update on public.quiz_attempts;
create policy quiz_attempts_team_update
on public.quiz_attempts
for update
to authenticated
using (
  exists (
    select 1
    from public.quiz_students qs
    where qs.id = quiz_attempts.quiz_student_id
      and (
        private.has_role('admin'::public.app_role)
        or private.teacher_has_student(qs.student_id)
        or exists (
          select 1
          from public.students s
          where s.id = qs.student_id
            and s.auth_user_id = (select auth.uid())
            and s.deleted_at is null
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.quiz_students qs
    where qs.id = quiz_attempts.quiz_student_id
      and (
        private.has_role('admin'::public.app_role)
        or private.teacher_has_student(qs.student_id)
        or exists (
          select 1
          from public.students s
          where s.id = qs.student_id
            and s.auth_user_id = (select auth.uid())
            and s.deleted_at is null
        )
      )
  )
);

drop policy if exists quiz_answers_student_insert on public.quiz_answers;
create policy quiz_answers_student_insert
on public.quiz_answers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.quiz_attempts qa
    join public.quiz_students qs on qs.id = qa.quiz_student_id
    where qa.id = quiz_answers.attempt_id
      and (
        private.has_role('admin'::public.app_role)
        or private.teacher_has_student(qs.student_id)
        or exists (
          select 1
          from public.students s
          where s.id = qs.student_id
            and s.auth_user_id = (select auth.uid())
            and s.deleted_at is null
        )
      )
  )
);

drop policy if exists quiz_answers_team_update on public.quiz_answers;
create policy quiz_answers_team_update
on public.quiz_answers
for update
to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts qa
    join public.quiz_students qs on qs.id = qa.quiz_student_id
    where qa.id = quiz_answers.attempt_id
      and (
        private.has_role('admin'::public.app_role)
        or private.teacher_has_student(qs.student_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.quiz_attempts qa
    join public.quiz_students qs on qs.id = qa.quiz_student_id
    where qa.id = quiz_answers.attempt_id
      and (
        private.has_role('admin'::public.app_role)
        or private.teacher_has_student(qs.student_id)
      )
  )
);
