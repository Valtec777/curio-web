"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentStudent } from "@/lib/student";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

async function removeUpload(supabase: any, path?: string | null) {
  if (!path) return;
  await supabase.storage.from("family-uploads").remove([path]);
}

export async function submitStudentNotebook(formData: FormData) {
  const parsed = z.object({
    assignmentId: z.string().uuid(),
    uploadedFilePath: z.string().trim().min(1).max(500),
    uploadedFileName: z.string().trim().min(1).max(220),
    uploadedMimeType: z.string().trim().min(1).max(180),
    uploadedFileSize: z.coerce.number().int().positive().max(MAX_BYTES),
  }).safeParse({
    assignmentId: formData.get("assignmentId"),
    uploadedFilePath: formData.get("uploadedFilePath"),
    uploadedFileName: formData.get("uploadedFileName"),
    uploadedMimeType: formData.get("uploadedMimeType"),
    uploadedFileSize: formData.get("uploadedFileSize"),
  });
  if (!parsed.success) redirect("/aluno/caderno?erro=Revise%20a%20atividade%20e%20anexe%20uma%20foto%20ou%20PDF.");

  const { viewer, student, supabase, viaGuardian } = await getCurrentStudent();
  const path = parsed.data.uploadedFilePath;
  if (viaGuardian) {
    if (path.startsWith(`${viewer.user.id}/`)) await removeUpload(supabase, path);
    redirect("/aluno/caderno?erro=Para%20enviar%20pelo%20respons%C3%A1vel%2C%20use%20a%20%C3%A1rea%20da%20Fam%C3%ADlia.");
  }

  const expectedPrefix = `${viewer.user.id}/${student.id}/student-activity/`;
  if (!path.startsWith(expectedPrefix) || !ALLOWED.has(parsed.data.uploadedMimeType)) {
    if (path.startsWith(`${viewer.user.id}/`)) await removeUpload(supabase, path);
    redirect("/aluno/caderno?erro=O%20arquivo%20enviado%20n%C3%A3o%20%C3%A9%20v%C3%A1lido.");
  }

  const { data: assignment } = await supabase
    .from("notebook_assignments")
    .select("id,student_id,status,needs_redo")
    .eq("id", parsed.data.assignmentId)
    .eq("student_id", student.id)
    .maybeSingle();
  if (!assignment || (!assignment.needs_redo && !["assigned", "in_progress"].includes(String(assignment.status)))) {
    await removeUpload(supabase, path);
    redirect("/aluno/caderno?erro=Esta%20atividade%20n%C3%A3o%20est%C3%A1%20dispon%C3%ADvel.");
  }

  const { error } = await supabase.rpc("submit_student_notebook_assignment", { p_assignment_id: assignment.id, p_file_path: path });
  if (error) {
    await removeUpload(supabase, path);
    redirect(`/aluno/caderno?erro=${encodeURIComponent(error.message || "Não foi possível concluir o envio.")}`);
  }

  await supabase.rpc("refresh_student_achievements", { p_student_id: student.id });
  revalidatePath("/aluno");
  revalidatePath("/aluno/caderno");
  revalidatePath("/aluno/conquistas");
  revalidatePath("/familia/atividades");
  revalidatePath("/professor/correcoes");
  redirect("/aluno/caderno?sucesso=Atividade%20enviada%20para%20a%20professora.");
}
