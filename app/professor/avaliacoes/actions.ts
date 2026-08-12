"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

const allowedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 110);
}

function bahiaDateTime(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T09:00:00-03:00`).toISOString();
  const normalized = raw.length === 16 ? `${raw}:00` : raw;
  const date = new Date(`${normalized}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function assessmentDateLabel(value?: string | null) {
  if (!value) return "data a confirmar";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

async function linkedStudentIds(supabase: any, teacherId: string, raw: string[]) {
  const ids = [...new Set(raw.filter((id) => z.string().uuid().safeParse(id).success))];
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("teacher_students")
    .select("student_id")
    .eq("teacher_id", teacherId)
    .eq("active", true)
    .in("student_id", ids);
  if (error) throw new Error("student lookup failed");
  const valid = new Set((data ?? []).map((item: any) => item.student_id));
  if (ids.some((id) => !valid.has(id))) throw new Error("invalid student");
  return ids;
}

async function notifyFamiliesAboutAssessment({
  supabase,
  assessmentId,
  title,
  scheduledFor,
  studentIds,
}: {
  supabase: any;
  assessmentId: string;
  title: string;
  scheduledFor: string | null;
  studentIds: string[];
}) {
  if (!studentIds.length) return { attempted: 0, failed: 0 };
  const { data: targets, error: targetError } = await supabase.rpc("teacher_chat_targets");
  if (targetError) {
    console.error("Falha ao localizar famílias para aviso de avaliação", targetError.code);
    return { attempted: 0, failed: studentIds.length };
  }

  const families = (targets ?? []).filter((target: any) =>
    target.target_kind === "family"
    && target.guardian_id
    && studentIds.includes(target.student_id)
  );
  const when = assessmentDateLabel(scheduledFor);
  let failed = 0;

  for (const family of families) {
    const { error } = await supabase.rpc("send_curio_family_message", {
      p_student_id: family.student_id,
      p_guardian_id: family.guardian_id,
      p_subject: `Nova avaliação de ${family.student_name}`,
      p_body: `Olá, ${family.target_name || "responsável"}! Foi registrada a avaliação “${title}” para ${family.student_name}, prevista para ${when}. Os detalhes ficam na área de Avaliações da Família.`,
      p_action_label: "Ver avaliações",
      p_action_url: "/familia/avaliacoes",
      p_request_key: `assessment:${assessmentId}:${family.student_id}:${family.guardian_id}`,
    });
    if (error) {
      failed += 1;
      console.error("Falha ao enviar aviso interno de avaliação", error.code);
    }
  }

  return { attempted: families.length, failed };
}

function invalidAssessment() {
  redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Não foi possível identificar a avaliação selecionada. Atualize a página e tente novamente.")}`);
}

export async function createTeacherAssessment(formData: FormData) {
  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/avaliacoes?erro=Perfil+incompleto");

  const parsed = z.object({
    title: z.string().trim().min(2).max(180),
    subjectId: z.string().uuid().optional().or(z.literal("")),
    gradeId: z.string().uuid().optional().or(z.literal("")),
    scheduledFor: z.string().min(10),
    instructions: z.string().trim().max(4000).optional(),
    gradingSchemeId: z.string().uuid().optional().or(z.literal("")),
  }).safeParse({
    title: formData.get("title"),
    subjectId: String(formData.get("subjectId") || ""),
    gradeId: String(formData.get("gradeId") || ""),
    scheduledFor: formData.get("scheduledFor"),
    instructions: String(formData.get("instructions") || ""),
    gradingSchemeId: String(formData.get("gradingSchemeId") || ""),
  });
  if (!parsed.success) redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Revise os dados da avaliação.")}`);

  const scheduledFor = bahiaDateTime(parsed.data.scheduledFor);
  if (!scheduledFor) redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Informe uma data válida.")}`);

  let students: string[] = [];
  try {
    students = await linkedStudentIds(supabase, teacher.id, formData.getAll("studentIds").map(String));
  } catch {
    redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Um dos alunos selecionados não está vinculado a você.")}`);
  }
  if (!students.length) redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Escolha pelo menos um aluno.")}`);

  const fileValue = formData.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  let filePath: string | null = null;
  if (file) {
    if (file.size > 15 * 1024 * 1024 || !allowedMimeTypes.has(file.type)) {
      redirect(`/professor/avaliacoes?erro=${encodeURIComponent("O arquivo opcional deve ser PDF, PNG, JPG ou WEBP de até 15 MB.")}`);
    }
    filePath = `${viewer.user.id}/avaliacoes/${Date.now()}-${safeFileName(file.name || "avaliacao.pdf")}`;
    const { error: uploadError } = await supabase.storage.from("teacher-materials").upload(filePath, file, { contentType: file.type, upsert: false });
    if (uploadError) redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Não foi possível anexar o arquivo da avaliação.")}`);
  }

  const { data: assessment, error } = await supabase.from("assessments").insert({
    created_by_teacher_id: teacher.id,
    title: parsed.data.title,
    subject_id: parsed.data.subjectId || null,
    grade_id: parsed.data.gradeId || null,
    instructions: parsed.data.instructions || null,
    scheduled_for: scheduledFor,
    grading_scheme_id: parsed.data.gradingSchemeId || null,
    file_path: filePath,
    status: "published",
  }).select("id").single();

  if (error || !assessment) {
    if (filePath) await supabase.storage.from("teacher-materials").remove([filePath]);
    redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Não foi possível criar a avaliação.")}`);
  }

  const { error: linkError } = await supabase.from("assessment_students").insert(
    students.map((studentId) => ({ assessment_id: assessment.id, student_id: studentId, status: "assigned" })),
  );
  if (linkError) {
    await supabase.from("assessments").delete().eq("id", assessment.id).eq("created_by_teacher_id", teacher.id);
    if (filePath) await supabase.storage.from("teacher-materials").remove([filePath]);
    redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Não foi possível atribuir a avaliação. O registro e o anexo recém-criados foram revertidos para evitar conteúdo órfão.")}`);
  }

  const notices = await notifyFamiliesAboutAssessment({
    supabase,
    assessmentId: assessment.id,
    title: parsed.data.title,
    scheduledFor,
    studentIds: students,
  });

  revalidatePath("/professor");
  revalidatePath("/professor/avaliacoes");
  revalidatePath("/professor/conteudos");
  revalidatePath("/aluno");
  revalidatePath("/familia/avaliacoes");
  revalidatePath("/familia/mensagens");
  const message = notices.failed
    ? `Avaliação criada para ${students.length} aluno(s). Um ou mais avisos internos da família não puderam ser enviados.`
    : `Avaliação criada para ${students.length} aluno(s) e família vinculada avisada no portal.`;
  redirect(`/professor/avaliacoes?sucesso=${encodeURIComponent(message)}`);
}

export async function assignTeacherAssessment(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") || "");
  if (!z.string().uuid().safeParse(assessmentId).success) invalidAssessment();
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/avaliacoes");
  const { data: assessment, error: assessmentError } = await supabase
    .from("assessments")
    .select("id,title,scheduled_for")
    .eq("id", assessmentId)
    .eq("created_by_teacher_id", teacher.id)
    .maybeSingle();
  if (assessmentError || !assessment) redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Avaliação não encontrada.")}`);

  let students: string[] = [];
  try {
    students = await linkedStudentIds(supabase, teacher.id, formData.getAll("studentIds").map(String));
  } catch {
    redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Revise os alunos selecionados.")}`);
  }
  if (!students.length) redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Escolha pelo menos um aluno.")}`);

  const { error: assignmentError } = await supabase.from("assessment_students").upsert(
    students.map((studentId) => ({ assessment_id: assessmentId, student_id: studentId, status: "assigned" })),
    { onConflict: "assessment_id,student_id", ignoreDuplicates: true },
  );
  if (assignmentError) redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Não foi possível atribuir a avaliação aos alunos selecionados.")}`);

  const { error: publishError } = await supabase.from("assessments")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", assessmentId)
    .eq("created_by_teacher_id", teacher.id);
  if (publishError) redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Os vínculos foram salvos, mas a avaliação não pôde ser publicada agora.")}`);

  const notices = await notifyFamiliesAboutAssessment({
    supabase,
    assessmentId,
    title: assessment.title,
    scheduledFor: assessment.scheduled_for,
    studentIds: students,
  });

  revalidatePath("/professor/avaliacoes");
  revalidatePath("/aluno");
  revalidatePath("/familia/avaliacoes");
  revalidatePath("/familia/mensagens");
  const message = notices.failed
    ? `Avaliação enviada para ${students.length} aluno(s). Um ou mais avisos internos da família não puderam ser enviados.`
    : `Avaliação enviada para ${students.length} aluno(s) e família vinculada avisada no portal.`;
  redirect(`/professor/avaliacoes?sucesso=${encodeURIComponent(message)}`);
}

export async function duplicateTeacherAssessment(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") || "");
  if (!z.string().uuid().safeParse(assessmentId).success) invalidAssessment();
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/avaliacoes");
  const { data: item, error: readError } = await supabase
    .from("assessments")
    .select("title,subject_id,grade_id,instructions,scheduled_for,grading_scheme_id,file_path")
    .eq("id", assessmentId)
    .eq("created_by_teacher_id", teacher.id)
    .maybeSingle();
  if (readError || !item) redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Avaliação não encontrada.")}`);

  const { error } = await supabase.from("assessments").insert({
    ...item,
    title: `${item.title} — cópia`,
    created_by_teacher_id: teacher.id,
    status: "draft",
  });
  if (error) redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Não foi possível duplicar a avaliação.")}`);
  revalidatePath("/professor/avaliacoes");
  revalidatePath("/professor/conteudos");
  redirect(`/professor/avaliacoes?sucesso=${encodeURIComponent("Avaliação duplicada como rascunho, sem alunos atribuídos.")}`);
}
