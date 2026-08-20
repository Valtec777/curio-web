-- Fix two correlation mistakes that denied legitimate student/guardian reads.

DROP POLICY IF EXISTS classes_select ON public.classes;
CREATE POLICY classes_select ON public.classes
FOR SELECT TO authenticated
USING (
  private.has_role('admin'::app_role)
  OR private.teacher_has_class(id)
  OR EXISTS (
    SELECT 1
    FROM public.class_students cs
    JOIN public.students s ON s.id = cs.student_id
    WHERE cs.class_id = classes.id
      AND cs.active = true
      AND s.auth_user_id = (SELECT auth.uid())
      AND s.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM public.class_students cs
    WHERE cs.class_id = classes.id
      AND cs.active = true
      AND private.guardian_has_student(cs.student_id)
  )
);

DROP POLICY IF EXISTS quizzes_select ON public.quizzes;
CREATE POLICY quizzes_select ON public.quizzes
FOR SELECT TO authenticated
USING (
  private.has_role('admin'::app_role)
  OR created_by_teacher_id = private.teacher_id_for_user()
  OR EXISTS (
    SELECT 1
    FROM public.quiz_students qs
    WHERE qs.quiz_id = quizzes.id
      AND (
        EXISTS (
          SELECT 1
          FROM public.students s
          WHERE s.id = qs.student_id
            AND s.auth_user_id = (SELECT auth.uid())
            AND s.deleted_at IS NULL
        )
        OR private.guardian_has_student(qs.student_id)
      )
  )
);
