"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentStudent } from "@/lib/student";
import { planLimitErrorMessage } from "@/lib/plan-usage";

export async function startStudentCourse(formData: FormData) {
  const parsed = z.object({ courseId: z.string().uuid(), slug: z.string().min(1).max(180) }).safeParse({ courseId: formData.get("courseId"), slug: formData.get("slug") });
  if (!parsed.success) redirect("/aluno/modo-pensar?erro=Curso%20inv%C3%A1lido.");
  const { student, supabase } = await getCurrentStudent();
  const { error } = await supabase.rpc("start_free_course", { p_course_id: parsed.data.courseId, p_student_id: student.id });
  if (error) {
    const planMessage = planLimitErrorMessage(error);
    redirect(`/aluno/modo-pensar?erro=${encodeURIComponent(planMessage || "Não foi possível iniciar este curso.")}`);
  }
  revalidatePath("/aluno/modo-pensar");
  revalidatePath("/familia/plano");
  redirect(`/aluno/modo-pensar/${encodeURIComponent(parsed.data.slug)}`);
}

export async function completeStudentCourseModule(formData: FormData) {
  const parsed = z.object({ moduleId: z.string().uuid(), slug: z.string().min(1).max(180) }).safeParse({ moduleId: formData.get("moduleId"), slug: formData.get("slug") });
  if (!parsed.success) redirect("/aluno/modo-pensar?erro=Etapa%20inv%C3%A1lida.");
  const { student, supabase } = await getCurrentStudent();
  const { error } = await supabase.rpc("complete_free_course_module", { p_module_id: parsed.data.moduleId, p_student_id: student.id });
  if (error) {
    const planMessage = planLimitErrorMessage(error);
    redirect(`/aluno/modo-pensar/${encodeURIComponent(parsed.data.slug)}?erro=${encodeURIComponent(planMessage || "Não foi possível concluir esta etapa.")}`);
  }
  await supabase.rpc("refresh_student_achievements", { p_student_id: student.id });
  revalidatePath("/aluno/modo-pensar");
  revalidatePath(`/aluno/modo-pensar/${parsed.data.slug}`);
  revalidatePath("/aluno/conquistas");
  redirect(`/aluno/modo-pensar/${encodeURIComponent(parsed.data.slug)}?sucesso=${encodeURIComponent("Etapa concluída. Continue quando quiser!")}`);
}
