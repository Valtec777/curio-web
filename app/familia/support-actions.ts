"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getFamilyPortal } from "@/lib/family";

function settingsPath(studentId: string, key: "erro" | "sucesso", message: string) {
  const params = new URLSearchParams({ aluno: studentId, [key]: message });
  return `/familia/configuracoes?${params.toString()}`;
}

export async function updateStudentLearningSupport(formData: FormData) {
  const parsed = z.object({
    studentId: z.string().uuid(),
    readingAutonomy: z.enum(["independent", "developing", "needs_support"]),
  }).safeParse({
    studentId: formData.get("studentId"),
    readingAutonomy: formData.get("readingAutonomy"),
  });

  if (!parsed.success) {
    redirect(`/familia/configuracoes?erro=${encodeURIComponent("Revise as preferências de apoio do aluno.")}`);
  }

  const { viewer, selectedChild, supabase } = await getFamilyPortal(parsed.data.studentId);
  if (selectedChild?.student_id !== parsed.data.studentId) {
    redirect(`/familia/configuracoes?erro=${encodeURIComponent("Aluno não vinculado a este responsável.")}`);
  }

  const guidedMode = formData.get("guidedMode") === "on";
  const audioInstructions = formData.get("audioInstructions") === "on";

  const { error } = await supabase.from("student_support_preferences").upsert({
    student_id: parsed.data.studentId,
    reading_autonomy: parsed.data.readingAutonomy,
    guided_mode: guidedMode,
    audio_instructions: audioInstructions,
    updated_by_user_id: viewer.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "student_id" });

  if (error) {
    console.error("Falha ao salvar apoio de leitura do aluno", error.code);
    redirect(settingsPath(parsed.data.studentId, "erro", "Não foi possível salvar essas preferências agora."));
  }

  revalidatePath("/familia/configuracoes");
  revalidatePath("/aluno", "layout");
  revalidatePath(`/professor/alunos/${parsed.data.studentId}`);
  redirect(settingsPath(parsed.data.studentId, "sucesso", "Preferências de leitura e acompanhamento salvas."));
}
