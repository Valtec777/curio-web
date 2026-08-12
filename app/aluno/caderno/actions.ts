"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentStudent } from "@/lib/student";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-100) || "atividade";
}

export async function submitStudentNotebook(formData: FormData) {
  const parsed = z.object({ assignmentId: z.string().uuid() }).safeParse({ assignmentId: formData.get("assignmentId") });
  if (!parsed.success) redirect("/aluno/caderno?erro=Atividade%20inv%C3%A1lida.");

  const { viewer, student, supabase, viaGuardian } = await getCurrentStudent();
  if (viaGuardian) redirect("/aluno/caderno?erro=Para%20enviar%20pelo%20respons%C3%A1vel%2C%20use%20a%20%C3%A1rea%20da%20Fam%C3%ADlia.");

  const file = formData.get("activityFile");
  if (!(file instanceof File) || !file.size) redirect("/aluno/caderno?erro=Escolha%20uma%20foto%20ou%20PDF.");
  if (file.size > MAX_BYTES) redirect("/aluno/caderno?erro=O%20arquivo%20pode%20ter%20at%C3%A9%2015%20MB.");
  if (!ALLOWED.has(file.type)) redirect("/aluno/caderno?erro=Envie%20PDF%2C%20PNG%2C%20JPG%20ou%20WEBP.");

  const { data: assignment } = await supabase
    .from("notebook_assignments")
    .select("id,student_id")
    .eq("id", parsed.data.assignmentId)
    .eq("student_id", student.id)
    .maybeSingle();
  if (!assignment) redirect("/aluno/caderno?erro=Esta%20atividade%20n%C3%A3o%20est%C3%A1%20dispon%C3%ADvel.");

  const path = `${viewer.user.id}/notebook-submissions/${student.id}/${assignment.id}/${Date.now()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from("family-uploads").upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) redirect("/aluno/caderno?erro=N%C3%A3o%20foi%20poss%C3%ADvel%20enviar%20o%20arquivo.");

  const { error } = await supabase.rpc("submit_student_notebook_assignment", { p_assignment_id: assignment.id, p_file_path: path });
  if (error) {
    await supabase.storage.from("family-uploads").remove([path]);
    redirect(`/aluno/caderno?erro=${encodeURIComponent(error.message || "Não foi possível concluir o envio.")}`);
  }

  await supabase.rpc("refresh_student_achievements", { p_student_id: student.id });
  revalidatePath("/aluno");
  revalidatePath("/aluno/caderno");
  revalidatePath("/aluno/conquistas");
  revalidatePath("/professor/correcoes");
  redirect("/aluno/caderno?sucesso=Atividade%20enviada%20para%20a%20professora.");
}
