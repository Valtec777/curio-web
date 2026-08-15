"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

const reviewSchema = z.object({
  submissionId: z.string().uuid(),
  answerId: z.string().uuid(),
  studentId: z.string().uuid(),
  questionId: z.string().uuid(),
  skillId: z.string().uuid(),
  domainLevel: z.coerce.number().int().min(0).max(4),
  autonomyLevel: z.coerce.number().int().min(0).max(4),
  score10: z.coerce.number().min(0).max(10),
  note: z.string().max(1800).optional(),
});

export async function reviewAnswer(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/correcoes");

  const parsed = reviewSchema.safeParse({
    submissionId: formData.get("submissionId"),
    answerId: formData.get("answerId"),
    studentId: formData.get("studentId"),
    questionId: formData.get("questionId"),
    skillId: formData.get("skillId"),
    domainLevel: formData.get("domainLevel"),
    autonomyLevel: formData.get("autonomyLevel"),
    score10: formData.get("score10"),
    note: formData.get("note"),
  });

  if (!parsed.success) redirect("/professor/correcoes?erro=" + encodeURIComponent("Revise a nota e os critérios pedagógicos."));
  const p = parsed.data;
  const normalizedScore = p.score10 / 10;

  const { data: linked } = await supabase.from("teacher_students").select("student_id").eq("teacher_id", teacher.id).eq("student_id", p.studentId).eq("active", true).maybeSingle();
  if (!linked) redirect(`/professor/correcoes?erro=${encodeURIComponent("Este aluno não está mais vinculado a você.")}`);

  const { error: answerError } = await supabase
    .from("answers")
    .update({ score: normalizedScore, reviewed_at: new Date().toISOString(), reviewed_by_teacher_id: teacher.id })
    .eq("id", p.answerId)
    .is("reviewed_at", null);
  if (answerError) redirect("/professor/correcoes?erro=" + encodeURIComponent("Não foi possível registrar a correção."));

  const { error: evidenceError } = await supabase.from("pedagogical_evidence").upsert({
    answer_id: p.answerId,
    student_id: p.studentId,
    teacher_id: teacher.id,
    question_id: p.questionId,
    skill_id: p.skillId,
    domain_level: p.domainLevel,
    autonomy_level: p.autonomyLevel,
    score: normalizedScore,
    teacher_note: p.note || null,
    source_type: "mission",
    observed_at: new Date().toISOString(),
  }, { onConflict: "answer_id,skill_id" });
  if (evidenceError) redirect("/professor/correcoes?erro=" + encodeURIComponent("A nota foi salva, mas a evidência pedagógica precisa ser revisada."));

  const { error: recalcError } = await supabase.rpc("recalculate_student_skill_state", { p_student_id: p.studentId, p_skill_id: p.skillId });
  if (recalcError) redirect("/professor/correcoes?erro=" + encodeURIComponent("A correção foi salva, mas o mapa pedagógico não pôde ser recalculado agora."));

  const { count } = await supabase.from("answers").select("id", { count: "exact", head: true }).eq("submission_id", p.submissionId).is("reviewed_at", null);
  if ((count ?? 0) === 0) {
    const { data: answerScores } = await supabase.from("answers").select("score").eq("submission_id", p.submissionId).not("score", "is", null);
    const values = (answerScores ?? []).map((item: any) => Number(item.score)).filter(Number.isFinite);
    const avg = values.length ? values.reduce((sum: number, value: number) => sum + value, 0) / values.length : null;
    await supabase.from("submissions").update({ review_status: "reviewed", reviewed_at: new Date().toISOString() }).eq("id", p.submissionId);
    const { data: submission } = await supabase.from("submissions").select("mission_student_id").eq("id", p.submissionId).maybeSingle();
    if (submission?.mission_student_id) {
      await supabase.from("mission_students").update({ status: "reviewed", completed_at: new Date().toISOString(), progress_percent: 100, after_score: avg == null ? null : Math.round(avg * 10000) / 100 }).eq("id", submission.mission_student_id);
    }
  }

  revalidatePath("/professor");
  revalidatePath("/professor/correcoes");
  revalidatePath(`/professor/alunos/${p.studentId}`);
  revalidatePath("/aluno/missoes");
  redirect("/professor/correcoes?sucesso=" + encodeURIComponent("Correção registrada e mapa pedagógico atualizado."));
}

export async function reviewNotebookAssignment(formData: FormData) {
  const parsed = z.object({
    assignmentId: z.string().uuid(),
    studentId: z.string().uuid(),
    score: z.coerce.number().min(0).max(100),
    stars: z.coerce.number().int().min(0).max(5).default(0),
    note: z.string().trim().max(2500).optional(),
    requestRedo: z.string().optional(),
  }).safeParse({
    assignmentId: formData.get("assignmentId"),
    studentId: formData.get("studentId"),
    score: formData.get("score"),
    stars: formData.get("stars") || 0,
    note: String(formData.get("note") || ""),
    requestRedo: String(formData.get("requestRedo") || ""),
  });
  if (!parsed.success) redirect(`/professor/correcoes?erro=${encodeURIComponent("Revise a nota do Caderno Plumareli.")}`);

  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/correcoes");
  const { data: linked } = await supabase.from("teacher_students").select("student_id").eq("teacher_id", teacher.id).eq("student_id", parsed.data.studentId).eq("active", true).maybeSingle();
  if (!linked) redirect(`/professor/correcoes?erro=${encodeURIComponent("Este aluno não está mais vinculado a você.")}`);

  const wantsRedo = parsed.data.requestRedo === "on";
  if (wantsRedo && !parsed.data.note) redirect(`/professor/correcoes?erro=${encodeURIComponent("Escreva a orientação para o aluno refazer a atividade.")}`);

  const { error } = await supabase.from("notebook_assignments").update({
    status: "reviewed",
    score: parsed.data.score,
    stars_awarded: parsed.data.stars,
    teacher_note: parsed.data.note || null,
    needs_redo: wantsRedo,
    redo_note: wantsRedo ? parsed.data.note || null : null,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.assignmentId).eq("student_id", parsed.data.studentId).eq("assigned_by_teacher_id", teacher.id);
  if (error) redirect(`/professor/correcoes?erro=${encodeURIComponent("Não foi possível salvar a correção do Caderno Plumareli.")}`);

  revalidatePath("/professor");
  revalidatePath("/professor/correcoes");
  revalidatePath(`/professor/alunos/${parsed.data.studentId}`);
  revalidatePath("/familia/atividades");
  revalidatePath("/aluno/caderno");
  redirect(`/professor/correcoes?sucesso=${encodeURIComponent(wantsRedo ? "Correção salva e atividade devolvida para refazer." : "Caderno Plumareli corrigido.")}`);
}

async function notifyFamilyAboutAssessmentResult({
  supabase,
  studentId,
  assessmentId,
  assessmentTitle,
  score,
}: {
  supabase: any;
  studentId: string;
  assessmentId: string;
  assessmentTitle: string;
  score: number;
}) {
  const { data: targets, error: targetError } = await supabase.rpc("teacher_chat_targets");
  if (targetError) {
    console.error("Falha ao localizar família para resultado da avaliação", targetError.code);
    return 1;
  }
  const families = (targets ?? []).filter((target: any) => target.target_kind === "family" && target.guardian_id && target.student_id === studentId);
  let failed = 0;
  for (const family of families) {
    const { error } = await supabase.rpc("send_curio_family_message", {
      p_student_id: studentId,
      p_guardian_id: family.guardian_id,
      p_subject: `Resultado de avaliação de ${family.student_name}`,
      p_body: `Olá, ${family.target_name || "responsável"}! O resultado da avaliação “${assessmentTitle}” de ${family.student_name} foi registrado: ${score}/100. A devolutiva completa está na área de Avaliações da Família.`,
      p_action_label: "Ver resultado",
      p_action_url: "/familia/avaliacoes",
      p_request_key: `assessment-result:${assessmentId}:${studentId}:${family.guardian_id}:${score}`,
    });
    if (error) {
      failed += 1;
      console.error("Falha ao enviar resultado da avaliação para família", error.code);
    }
  }
  return failed;
}

export async function reviewAssessmentAssignment(formData: FormData) {
  const parsed = z.object({
    assignmentId: z.string().uuid(),
    studentId: z.string().uuid(),
    score: z.coerce.number().min(0).max(100),
    note: z.string().trim().max(2500).optional(),
  }).safeParse({
    assignmentId: formData.get("assignmentId"),
    studentId: formData.get("studentId"),
    score: formData.get("score"),
    note: String(formData.get("note") || ""),
  });
  if (!parsed.success) redirect(`/professor/correcoes?erro=${encodeURIComponent("Revise a nota e a devolutiva da avaliação.")}`);

  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/correcoes");

  const [{ data: linked, error: linkError }, { data: assignment, error: assignmentError }] = await Promise.all([
    supabase.from("teacher_students").select("student_id").eq("teacher_id", teacher.id).eq("student_id", parsed.data.studentId).eq("active", true).maybeSingle(),
    supabase.from("assessment_students").select("id,assessment_id,student_id,status,assessments(id,title,created_by_teacher_id)").eq("id", parsed.data.assignmentId).eq("student_id", parsed.data.studentId).maybeSingle(),
  ]);

  if (linkError || !linked) redirect(`/professor/correcoes?erro=${encodeURIComponent("Este aluno não está mais vinculado a você.")}`);
  if (assignmentError || !assignment) redirect(`/professor/correcoes?erro=${encodeURIComponent("A avaliação não foi encontrada para este aluno.")}`);

  const relation: any = (assignment as any).assessments;
  const assessment = Array.isArray(relation) ? relation[0] : relation;
  if (!assessment || assessment.created_by_teacher_id !== teacher.id) {
    redirect(`/professor/correcoes?erro=${encodeURIComponent("Somente o professor que criou esta avaliação pode registrar o resultado.")}`);
  }
  if (assignment.status === "cancelled") redirect(`/professor/correcoes?erro=${encodeURIComponent("Esta avaliação foi cancelada e não pode receber nota.")}`);

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase.from("assessment_students").update({
    status: "reviewed",
    score: parsed.data.score,
    teacher_note: parsed.data.note || null,
    reviewed_at: now,
  }).eq("id", parsed.data.assignmentId).eq("assessment_id", assignment.assessment_id).eq("student_id", parsed.data.studentId).select("id").maybeSingle();
  if (error || !updated) redirect(`/professor/correcoes?erro=${encodeURIComponent("Não foi possível registrar o resultado da avaliação.")}`);

  const failedNotices = await notifyFamilyAboutAssessmentResult({
    supabase,
    studentId: parsed.data.studentId,
    assessmentId: assignment.assessment_id,
    assessmentTitle: assessment.title || "Avaliação",
    score: parsed.data.score,
  });

  revalidatePath("/professor");
  revalidatePath("/professor/correcoes");
  revalidatePath("/professor/avaliacoes");
  revalidatePath(`/professor/alunos/${parsed.data.studentId}`);
  revalidatePath("/familia/avaliacoes");
  revalidatePath("/familia/progresso");
  revalidatePath("/familia/mensagens");
  revalidatePath("/aluno");
  const message = failedNotices
    ? "Resultado salvo. Um aviso interno da família não pôde ser entregue, mas a nota já aparece em Avaliações."
    : "Resultado da avaliação salvo e família vinculada avisada no portal.";
  redirect(`/professor/correcoes?sucesso=${encodeURIComponent(message)}`);
}
