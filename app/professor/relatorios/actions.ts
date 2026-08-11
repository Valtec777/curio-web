"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));

const reportSchema = z.object({
  studentId: z.string().uuid(),
  reportType: z.enum(["pedagogical", "monthly", "assessment", "continuity"]),
  periodStart: optionalDate,
  periodEnd: optionalDate,
  narrative: z.string().trim().min(20, "Escreva uma devolutiva um pouco mais completa.").max(12000),
}).superRefine((value, ctx) => {
  if (value.periodStart && value.periodEnd && value.periodEnd < value.periodStart) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A data final não pode ser anterior à data inicial." });
  }
});

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 110) || "relatorio.pdf";
}

export async function createTeacherReport(formData: FormData) {
  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) redirect(`/professor/relatorios?erro=${encodeURIComponent("Perfil de professor ainda não vinculado.")}`);

  const parsed = reportSchema.safeParse({
    studentId: formData.get("studentId"),
    reportType: formData.get("reportType"),
    periodStart: String(formData.get("periodStart") || ""),
    periodEnd: String(formData.get("periodEnd") || ""),
    narrative: formData.get("narrative"),
  });
  if (!parsed.success) {
    redirect(`/professor/relatorios?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Revise o relatório.")}`);
  }

  const { data: link, error: linkError } = await supabase
    .from("teacher_students")
    .select("student_id,students(id,deleted_at)")
    .eq("teacher_id", teacher.id)
    .eq("student_id", parsed.data.studentId)
    .eq("active", true)
    .maybeSingle();
  const linkedStudent: any = Array.isArray((link as any)?.students) ? (link as any).students[0] : (link as any)?.students;
  if (linkError || !link || !linkedStudent || linkedStudent.deleted_at) {
    redirect(`/professor/relatorios?erro=${encodeURIComponent("Este aluno não está mais vinculado ao seu acompanhamento ativo.")}`);
  }

  const fileValue = formData.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  let filePath: string | null = null;
  if (file) {
    if (file.type !== "application/pdf") {
      redirect(`/professor/relatorios?erro=${encodeURIComponent("O anexo do relatório precisa ser um PDF.")}`);
    }
    if (file.size > 15 * 1024 * 1024) {
      redirect(`/professor/relatorios?erro=${encodeURIComponent("O PDF do relatório pode ter no máximo 15 MB.")}`);
    }
    filePath = `${viewer.user.id}/reports/${parsed.data.studentId}/${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("generated-documents")
      .upload(filePath, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      console.error("Falha ao anexar relatório pedagógico", uploadError.message);
      redirect(`/professor/relatorios?erro=${encodeURIComponent("Não foi possível anexar o PDF do relatório.")}`);
    }
  }

  const { error } = await supabase.from("generated_reports").insert({
    student_id: parsed.data.studentId,
    generated_by_user_id: viewer.user.id,
    report_type: parsed.data.reportType,
    period_start: parsed.data.periodStart || null,
    period_end: parsed.data.periodEnd || null,
    narrative: parsed.data.narrative,
    file_path: filePath,
    structured_snapshot: {
      source: "teacher_manual",
      teacher_id: teacher.id,
      published_by_role: "teacher",
    },
  });

  if (error) {
    if (filePath) await supabase.storage.from("generated-documents").remove([filePath]);
    console.error("Falha ao publicar relatório pedagógico", error.code);
    redirect(`/professor/relatorios?erro=${encodeURIComponent("Não foi possível publicar o relatório. Nenhum anexo órfão foi mantido.")}`);
  }

  revalidatePath("/professor/relatorios");
  revalidatePath("/familia/relatorios");
  revalidatePath("/familia");
  redirect(`/professor/relatorios?sucesso=${encodeURIComponent("Relatório publicado para a família vinculada.")}`);
}
