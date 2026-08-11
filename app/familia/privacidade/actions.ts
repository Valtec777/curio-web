"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const childScopedSlugs = new Set([
  "consentimento-dados-pessoais",
  "autorizacao-imagem-voz-producoes",
]);

const optionalDecisionSlugs = new Set([
  "consentimento-dados-pessoais",
  "autorizacao-imagem-voz-producoes",
]);

function destination(key: "erro" | "sucesso", message: string) {
  const params = new URLSearchParams({ [key]: message });
  return `/familia/privacidade?${params.toString()}`;
}

export async function recordFamilyLegalDecision(formData: FormData) {
  const parsed = z.object({
    documentId: z.string().uuid(),
    studentId: z.string().uuid().optional().or(z.literal("")),
    decision: z.enum(["accepted", "declined", "revoked"]),
  }).safeParse({
    documentId: formData.get("documentId"),
    studentId: String(formData.get("studentId") || ""),
    decision: formData.get("decision"),
  });

  if (!parsed.success) redirect(destination("erro", "Não foi possível registrar essa escolha."));

  const viewer = await requireRole("guardian");
  const supabase = await createClient();
  const { data: guardian } = await supabase
    .from("guardians")
    .select("id,active")
    .eq("profile_id", viewer.user.id)
    .maybeSingle();

  if (!guardian?.active) redirect(destination("erro", "O perfil da família precisa estar ativo para registrar autorizações."));

  const { data: document } = await supabase
    .from("legal_documents")
    .select("id,public_slug,status,is_current,body,file_path")
    .eq("id", parsed.data.documentId)
    .eq("status", "published")
    .eq("is_current", true)
    .maybeSingle();

  if (!document || (!document.body && !document.file_path)) {
    redirect(destination("erro", "Este documento não está publicado na versão atual."));
  }

  const childScoped = childScopedSlugs.has(document.public_slug);
  const studentId = parsed.data.studentId || null;

  if (childScoped && !studentId) {
    redirect(destination("erro", "Escolha a criança vinculada antes de registrar essa autorização."));
  }

  if (!childScoped && studentId) {
    redirect(destination("erro", "Este documento é aceito pela conta do responsável, não por criança."));
  }

  if (studentId) {
    const { data: link } = await supabase
      .from("guardian_students")
      .select("student_id,students(deleted_at)")
      .eq("guardian_id", guardian.id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (!link || (link as any).students?.deleted_at) {
      redirect(destination("erro", "Esta criança não está vinculada à sua conta."));
    }
  }

  if (!optionalDecisionSlugs.has(document.public_slug) && parsed.data.decision !== "accepted") {
    redirect(destination("erro", "Para este documento, o portal registra apenas a confirmação de leitura e concordância."));
  }

  const { error } = await supabase.from("legal_acceptance_events").insert({
    legal_document_id: document.id,
    student_id: studentId,
    decision: parsed.data.decision,
  });

  if (error) redirect(destination("erro", "Não foi possível registrar agora. Tente novamente."));

  revalidatePath("/familia/privacidade");
  revalidatePath("/admin/documentos");
  redirect(destination("sucesso", "Sua escolha foi registrada com a versão e o horário do documento."));
}
