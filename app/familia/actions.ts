"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getFamilyPortal } from "@/lib/family";

const uploadTypes = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const imageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 110);
}

function familyPath(path: string, studentId?: string | null, key: "erro" | "sucesso" = "sucesso", message?: string) {
  const params = new URLSearchParams();
  if (studentId) params.set("aluno", studentId);
  if (message) params.set(key, message);
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

function fileFrom(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

async function uploadFamilyFile(file: File, userId: string, studentId: string, kind: string, supabase: any) {
  if (file.size > 15 * 1024 * 1024) throw new Error("size");
  if (!uploadTypes.has(file.type)) throw new Error("type");
  const path = `${userId}/${studentId}/${kind}/${Date.now()}-${safeFileName(file.name || "arquivo.pdf")}`;
  const { error } = await supabase.storage.from("family-uploads").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("upload");
  return path;
}

export async function uploadFamilySchoolContent(formData: FormData) {
  const parsed = z.object({
    studentId: z.string().uuid(),
    title: z.string().trim().min(2).max(180),
    subjectId: z.string().uuid().optional().or(z.literal("")),
    contentType: z.enum(["school_material", "notebook_photo", "school_notice", "assignment", "assessment_notice", "other"]),
    description: z.string().trim().max(2500).optional(),
    relatedDate: z.string().max(10).optional(),
  }).safeParse({
    studentId: formData.get("studentId"),
    title: formData.get("title"),
    subjectId: String(formData.get("subjectId") || ""),
    contentType: formData.get("contentType"),
    description: String(formData.get("description") || ""),
    relatedDate: String(formData.get("relatedDate") || ""),
  });
  if (!parsed.success) redirect(familyPath("/familia/conteudos", String(formData.get("studentId") || ""), "erro", "Revise os dados do conteúdo."));

  const { viewer, guardian, selectedChild, supabase } = await getFamilyPortal(parsed.data.studentId);
  if (!guardian?.active || selectedChild?.student_id !== parsed.data.studentId) redirect("/familia/conteudos?erro=" + encodeURIComponent("Criança não vinculada."));
  const file = fileFrom(formData, "schoolFile");
  if (!file) redirect(familyPath("/familia/conteudos", parsed.data.studentId, "erro", "Escolha um PDF ou imagem."));

  let path = "";
  try { path = await uploadFamilyFile(file, viewer.user.id, parsed.data.studentId, "school", supabase); }
  catch { redirect(familyPath("/familia/conteudos", parsed.data.studentId, "erro", "Não foi possível anexar o arquivo. Use PDF, PNG, JPG ou WEBP de até 15 MB.")); }

  const { error } = await supabase.from("family_school_uploads").insert({
    guardian_id: guardian.id,
    student_id: parsed.data.studentId,
    subject_id: parsed.data.subjectId || null,
    title: parsed.data.title,
    content_type: parsed.data.contentType,
    description: parsed.data.description || null,
    related_date: parsed.data.relatedDate || null,
    file_path: path,
    file_name: file.name,
    mime_type: file.type,
  });
  if (error) {
    await supabase.storage.from("family-uploads").remove([path]);
    redirect(familyPath("/familia/conteudos", parsed.data.studentId, "erro", "Não foi possível registrar o conteúdo."));
  }

  revalidatePath("/familia");
  revalidatePath("/familia/conteudos");
  revalidatePath("/professor/alunos");
  redirect(familyPath("/familia/conteudos", parsed.data.studentId, "sucesso", "Conteúdo enviado para o acompanhamento."));
}

export async function submitFamilyNotebookActivity(formData: FormData) {
  const parsed = z.object({ assignmentId: z.string().uuid(), studentId: z.string().uuid(), note: z.string().trim().max(1500).optional() }).safeParse({
    assignmentId: formData.get("assignmentId"),
    studentId: formData.get("studentId"),
    note: String(formData.get("note") || ""),
  });
  if (!parsed.success) redirect("/familia/atividades?erro=" + encodeURIComponent("Atividade inválida."));
  const { viewer, selectedChild, supabase } = await getFamilyPortal(parsed.data.studentId);
  if (selectedChild?.student_id !== parsed.data.studentId) redirect("/familia/atividades?erro=" + encodeURIComponent("Criança não vinculada."));
  const file = fileFrom(formData, "activityFile");
  if (!file) redirect(familyPath("/familia/atividades", parsed.data.studentId, "erro", "Escolha a foto ou PDF da atividade."));

  let path = "";
  try { path = await uploadFamilyFile(file, viewer.user.id, parsed.data.studentId, "activity", supabase); }
  catch { redirect(familyPath("/familia/atividades", parsed.data.studentId, "erro", "Não foi possível anexar a atividade.")); }

  const { error } = await supabase.rpc("submit_guardian_notebook_assignment", {
    p_assignment_id: parsed.data.assignmentId,
    p_file_path: path,
    p_note: parsed.data.note || null,
  });
  if (error) {
    await supabase.storage.from("family-uploads").remove([path]);
    redirect(familyPath("/familia/atividades", parsed.data.studentId, "erro", "Não foi possível enviar esta atividade."));
  }

  revalidatePath("/familia/atividades");
  revalidatePath("/professor/correcoes");
  redirect(familyPath("/familia/atividades", parsed.data.studentId, "sucesso", "Atividade enviada para correção."));
}

export async function reportFamilyAssessment(formData: FormData) {
  const parsed = z.object({
    studentId: z.string().uuid(), subjectId: z.string().uuid().optional().or(z.literal("")), origin: z.enum(["guardian", "school"]),
    title: z.string().trim().min(2).max(180), assessmentDate: z.string().min(10).max(10), content: z.string().trim().max(2500).optional(), observations: z.string().trim().max(2500).optional(),
  }).safeParse({
    studentId: formData.get("studentId"), subjectId: String(formData.get("subjectId") || ""), origin: formData.get("origin"), title: formData.get("title"),
    assessmentDate: formData.get("assessmentDate"), content: String(formData.get("content") || ""), observations: String(formData.get("observations") || ""),
  });
  if (!parsed.success) redirect(familyPath("/familia/avaliacoes", String(formData.get("studentId") || ""), "erro", "Revise os dados da avaliação."));
  const { viewer, guardian, selectedChild, supabase } = await getFamilyPortal(parsed.data.studentId);
  if (!guardian?.active || selectedChild?.student_id !== parsed.data.studentId) redirect("/familia/avaliacoes?erro=" + encodeURIComponent("Criança não vinculada."));

  const file = fileFrom(formData, "assessmentFile");
  let path: string | null = null;
  if (file) {
    try { path = await uploadFamilyFile(file, viewer.user.id, parsed.data.studentId, "assessment", supabase); }
    catch { redirect(familyPath("/familia/avaliacoes", parsed.data.studentId, "erro", "Não foi possível anexar o arquivo da avaliação.")); }
  }

  const { error } = await supabase.from("family_assessment_reports").insert({
    guardian_id: guardian.id,
    student_id: parsed.data.studentId,
    subject_id: parsed.data.subjectId || null,
    origin: parsed.data.origin,
    title: parsed.data.title,
    assessment_date: parsed.data.assessmentDate,
    content: parsed.data.content || null,
    observations: parsed.data.observations || null,
    file_path: path,
    file_name: file?.name || null,
    mime_type: file?.type || null,
  });
  if (error) {
    if (path) await supabase.storage.from("family-uploads").remove([path]);
    redirect(familyPath("/familia/avaliacoes", parsed.data.studentId, "erro", "Não foi possível salvar a avaliação."));
  }

  revalidatePath("/familia/avaliacoes");
  revalidatePath("/professor/alunos");
  redirect(familyPath("/familia/avaliacoes", parsed.data.studentId, "sucesso", "Avaliação informada para a equipe."));
}

export async function updateFamilyProfile(formData: FormData) {
  const parsed = z.object({ fullName: z.string().trim().min(2).max(180), preferredName: z.string().trim().max(100).optional(), phone: z.string().trim().max(40).optional(), studentId: z.string().uuid().optional().or(z.literal("")) }).safeParse({
    fullName: formData.get("fullName"), preferredName: String(formData.get("preferredName") || ""), phone: String(formData.get("phone") || ""), studentId: String(formData.get("studentId") || ""),
  });
  if (!parsed.success) redirect("/familia/perfil?erro=" + encodeURIComponent("Revise seus dados."));
  const { viewer, supabase } = await getFamilyPortal(parsed.data.studentId || null);
  const { error } = await supabase.from("profiles").update({
    full_name: parsed.data.fullName,
    preferred_name: parsed.data.preferredName || null,
    phone_whatsapp: parsed.data.phone || null,
    updated_at: new Date().toISOString(),
  }).eq("id", viewer.user.id);
  if (error) redirect(familyPath("/familia/perfil", parsed.data.studentId || null, "erro", "Não foi possível salvar o perfil."));
  revalidatePath("/familia");
  revalidatePath("/familia/perfil");
  redirect(familyPath("/familia/perfil", parsed.data.studentId || null, "sucesso", "Perfil atualizado."));
}

export async function uploadFamilyAvatar(formData: FormData) {
  const studentId = String(formData.get("studentId") || "");
  const { viewer, supabase } = await getFamilyPortal(studentId || null);
  const file = fileFrom(formData, "avatar");
  if (!file || file.size > 5 * 1024 * 1024 || !imageTypes.has(file.type)) redirect(familyPath("/familia/perfil", studentId || null, "erro", "Use PNG, JPG ou WEBP de até 5 MB."));
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${viewer.user.id}/familia-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) redirect(familyPath("/familia/perfil", studentId || null, "erro", "Não foi possível enviar a foto."));
  const { data: oldProfile } = await supabase.from("profiles").select("avatar_path").eq("id", viewer.user.id).maybeSingle();
  const { error } = await supabase.from("profiles").update({ avatar_path: path, updated_at: new Date().toISOString() }).eq("id", viewer.user.id);
  if (error) { await supabase.storage.from("profile-avatars").remove([path]); redirect(familyPath("/familia/perfil", studentId || null, "erro", "Não foi possível salvar a foto.")); }
  if (oldProfile?.avatar_path?.startsWith(`${viewer.user.id}/`)) await supabase.storage.from("profile-avatars").remove([oldProfile.avatar_path]);
  revalidatePath("/familia/perfil");
  redirect(familyPath("/familia/perfil", studentId || null, "sucesso", "Foto atualizada."));
}

export async function updateFamilyNotifications(formData: FormData) {
  const studentId = String(formData.get("studentId") || "");
  const { viewer, supabase } = await getFamilyPortal(studentId || null);
  const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", viewer.user.id).maybeSingle();
  const preferences = profile?.preferences && typeof profile.preferences === "object" ? profile.preferences : {};
  const next = {
    ...preferences,
    notifications: {
      email: formData.get("email") === "on",
      app: formData.get("app") === "on",
      whatsapp: formData.get("whatsapp") === "on",
    },
  };
  const { error } = await supabase.from("profiles").update({ preferences: next, updated_at: new Date().toISOString() }).eq("id", viewer.user.id);
  if (error) redirect(familyPath("/familia/configuracoes", studentId || null, "erro", "Não foi possível salvar as notificações."));
  revalidatePath("/familia/configuracoes");
  redirect(familyPath("/familia/configuracoes", studentId || null, "sucesso", "Preferências de notificação salvas."));
}

export async function signFamilyContract(formData: FormData) {
  const parsed = z.object({ contractId: z.string().uuid(), studentId: z.string().uuid().optional().or(z.literal("")), accepted: z.literal("on") }).safeParse({
    contractId: formData.get("contractId"), studentId: String(formData.get("studentId") || ""), accepted: formData.get("accepted"),
  });
  if (!parsed.success) redirect(familyPath("/familia/contrato", String(formData.get("studentId") || ""), "erro", "Leia o documento e confirme a ciência antes de assinar."));
  const { supabase } = await getFamilyPortal(parsed.data.studentId || null);
  const { data, error } = await supabase.rpc("sign_guardian_contract", { p_contract_id: parsed.data.contractId });
  if (error || data !== true) redirect(familyPath("/familia/contrato", parsed.data.studentId || null, "erro", "Este contrato ainda não está disponível para assinatura."));
  revalidatePath("/familia/contrato");
  revalidatePath("/admin");
  redirect(familyPath("/familia/contrato", parsed.data.studentId || null, "sucesso", "Assinatura registrada no portal."));
}

export async function sendFamilyChatMessage(formData: FormData) {
  const parsed = z.object({
    threadId: z.string().uuid().optional().or(z.literal("")), studentId: z.string().uuid().optional().or(z.literal("")), teacherId: z.string().uuid().optional().or(z.literal("")), body: z.string().trim().min(1).max(5000), requestKey: z.string().min(8).max(160),
  }).safeParse({
    threadId: String(formData.get("threadId") || ""), studentId: String(formData.get("studentId") || ""), teacherId: String(formData.get("teacherId") || ""), body: formData.get("body"), requestKey: formData.get("requestKey"),
  });
  if (!parsed.success) redirect("/familia/mensagens?erro=" + encodeURIComponent("Escreva uma mensagem e escolha o professor."));
  const { supabase } = await getFamilyPortal(parsed.data.studentId || null);
  const { data, error } = await supabase.rpc("send_guardian_teacher_chat_message", {
    p_thread_id: parsed.data.threadId || null,
    p_student_id: parsed.data.studentId || null,
    p_teacher_id: parsed.data.teacherId || null,
    p_body: parsed.data.body,
    p_request_key: parsed.data.requestKey,
  });
  if (error) redirect(familyPath("/familia/mensagens", parsed.data.studentId || null, "erro", "Não foi possível enviar a mensagem agora."));
  const result = Array.isArray(data) ? data[0] : data;
  const params = new URLSearchParams();
  if (parsed.data.studentId) params.set("aluno", parsed.data.studentId);
  if (result?.thread_id || parsed.data.threadId) params.set("conversa", result?.thread_id || parsed.data.threadId || "");
  revalidatePath("/familia/mensagens");
  revalidatePath("/professor/mensagens");
  redirect(`/familia/mensagens?${params.toString()}`);
}
