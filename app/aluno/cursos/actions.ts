"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentStudent } from "@/lib/student";

const uuidSchema = z.string().uuid();

export async function startFreeCourse(formData: FormData) {
  const { student, supabase } = await getCurrentStudent();
  const courseId = uuidSchema.safeParse(String(formData.get("courseId") || ""));
  if (!courseId.success) redirect("/aluno/modo-pensar");

  const { error } = await supabase.rpc("start_free_course", {
    p_course_id: courseId.data,
    p_student_id: student.id,
  });

  if (error) redirect(`/aluno/modo-pensar?erro=${encodeURIComponent("Não foi possível iniciar este curso agora.")}`);
  revalidatePath("/aluno/modo-pensar");
  redirect(`/aluno/cursos/${courseId.data}`);
}

export async function completeFreeCourseModule(formData: FormData) {
  const { student, supabase } = await getCurrentStudent();
  const moduleId = uuidSchema.safeParse(String(formData.get("moduleId") || ""));
  const courseId = uuidSchema.safeParse(String(formData.get("courseId") || ""));
  if (!moduleId.success || !courseId.success) redirect("/aluno/modo-pensar");

  const { data, error } = await supabase.rpc("complete_free_course_module", {
    p_module_id: moduleId.data,
    p_student_id: student.id,
  });

  if (error) redirect(`/aluno/cursos/${courseId.data}?erro=${encodeURIComponent("Não foi possível registrar esta etapa.")}`);

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath(`/aluno/cursos/${courseId.data}`);
  revalidatePath("/aluno/modo-pensar");
  if (row?.course_completed) {
    redirect(`/aluno/cursos/${courseId.data}?sucesso=${encodeURIComponent("Curso concluído! Seu certificado já está disponível.")}`);
  }
  redirect(`/aluno/cursos/${courseId.data}?sucesso=${encodeURIComponent("Etapa concluída. Continue avançando!")}`);
}
