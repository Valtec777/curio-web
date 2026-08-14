"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const providerSchema = z.object({
  brandName: z.string().trim().min(2).max(100),
  legalName: z.string().trim().min(3).max(180),
  taxId: z.string().trim().min(11).max(30),
  address: z.string().trim().min(5).max(500),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(8).max(50),
  privacyContact: z.string().trim().email().max(180),
});

export async function updateLegalProviderProfile(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = providerSchema.safeParse({
    brandName: formData.get("brandName"), legalName: formData.get("legalName"), taxId: formData.get("taxId"), address: formData.get("address"), email: formData.get("email"), phone: formData.get("phone"), privacyContact: formData.get("privacyContact"),
  });
  if (!parsed.success) redirect(`/admin/documentos/prestadora?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Revise os dados da prestadora.")}`);
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert({ key: "legal_provider_profile", value: parsed.data, is_public: true, updated_by_user_id: viewer.user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) redirect(`/admin/documentos/prestadora?erro=${encodeURIComponent("Não foi possível salvar a identificação jurídica da prestadora.")}`);
  revalidatePath("/admin/documentos"); revalidatePath("/admin/documentos/prestadora"); revalidatePath("/"); revalidatePath("/familia/contrato");
  redirect(`/admin/documentos/prestadora?sucesso=${encodeURIComponent("Dados salvos. Eles serão reutilizados automaticamente nos documentos e PDFs gerados.")}`);
}

const removeDocumentSchema = z.object({ documentId: z.string().uuid(), reason: z.string().max(300).optional() });
export async function moveDocumentToTrash(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = removeDocumentSchema.safeParse({ documentId: formData.get("documentId"), reason: String(formData.get("reason") || "") });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { data: document, error: documentError } = await supabase.from("documents").select("id,title,document_type,file_path,student_id,guardian_id,subscription_id,visible_to_guardian,created_by_user_id,created_at,deleted_at").eq("id", parsed.data.documentId).maybeSingle();
  if (documentError || !document || document.deleted_at) redirect(`/admin/documentos?erro=${encodeURIComponent("Documento não encontrado ou já removido.")}`);
  const now = new Date(); const reason = parsed.data.reason?.trim() || "Removido pelo Admin";
  const { error: trashError } = await supabase.from("trash_items").insert({ entity_type: "documents", entity_id: document.id, entity_snapshot: { label: document.title, document_type: document.document_type, file_path: document.file_path, student_id: document.student_id, guardian_id: document.guardian_id, subscription_id: document.subscription_id, visible_to_guardian: document.visible_to_guardian, created_by_user_id: document.created_by_user_id, created_at: document.created_at, reason }, deleted_by_user_id: viewer.user.id, deleted_at: now.toISOString(), restore_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() });
  if (trashError?.code === "23505") redirect(`/admin/documentos?erro=${encodeURIComponent("Este documento já está na Lixeira.")}`);
  if (trashError) redirect(`/admin/documentos?erro=${encodeURIComponent("Não foi possível enviar o documento para a Lixeira.")}`);
  const { error: deleteError } = await supabase.from("documents").update({ deleted_at: now.toISOString(), deleted_by_user_id: viewer.user.id, delete_reason: reason }).eq("id", document.id).is("deleted_at", null);
  if (deleteError) { await supabase.from("trash_items").delete().eq("entity_type", "documents").eq("entity_id", document.id).is("restored_at", null); redirect(`/admin/documentos?erro=${encodeURIComponent("O documento não foi removido da operação. Nenhuma entrada incompleta foi mantida na Lixeira.")}`); }
  revalidatePath("/admin/documentos"); revalidatePath("/admin/lixeira"); revalidatePath("/familia/contrato"); revalidatePath("/familia");
  redirect(`/admin/documentos?sucesso=${encodeURIComponent("Documento enviado para a Lixeira. Arquivo, vínculos e ID foram preservados.")}`);
}
