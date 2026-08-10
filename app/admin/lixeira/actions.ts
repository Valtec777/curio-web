"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const accessStatuses = new Set(["pending", "sent", "accepted", "cancelled", "error"]);
const requestStatuses = new Set(["new", "contacted", "qualified", "enrolled", "closed"]);
const studentStatuses = new Set(["active", "paused", "inactive", "pilot"]);

function previousStatus(snapshot: Record<string, unknown> | null | undefined, allowed: Set<string>, fallback: string) {
  const value = String(snapshot?.previous_status || "");
  return allowed.has(value) ? value : fallback;
}

function refreshOperationalPaths() {
  revalidatePath("/admin/lixeira");
  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/alunos");
  revalidatePath("/admin/familias");
  revalidatePath("/admin/professores");
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/mensagens");
  revalidatePath("/professor");
  revalidatePath("/professor/mensagens");
  revalidatePath("/familia");
  revalidatePath("/familia/mensagens");
  revalidatePath("/aluno");
}

export async function restoreTrashItem(formData: FormData) {
  await requireRole("admin");
  const trashId = z.string().uuid().safeParse(formData.get("trashId"));
  if (!trashId.success) return;

  const supabase = await createClient();
  const { data: item, error: itemError } = await supabase
    .from("trash_items")
    .select("id,entity_type,entity_id,entity_snapshot,restore_until,restored_at")
    .eq("id", trashId.data)
    .maybeSingle();

  if (itemError || !item || item.restored_at || !item.entity_id) {
    redirect(`/admin/lixeira?erro=${encodeURIComponent("Item não encontrado ou já restaurado.")}`);
  }
  if (item.restore_until && new Date(item.restore_until).getTime() < Date.now()) {
    redirect(`/admin/lixeira?erro=${encodeURIComponent("O prazo de restauração terminou.")}`);
  }

  const snapshot = (item.entity_snapshot || {}) as Record<string, unknown>;
  let restoreError: { message: string } | null = null;
  let successMessage = "Item restaurado.";

  if (item.entity_type === "plans") {
    const { error } = await supabase.from("plans").update({
      deleted_at: null,
      deleted_by_user_id: null,
      active: false,
      archived_at: null,
      visible_on_landing: false,
      updated_at: new Date().toISOString(),
    }).eq("id", item.entity_id);
    restoreError = error;
    successMessage = "Plano restaurado como rascunho.";
  } else if (item.entity_type === "access_invitations") {
    const { error } = await supabase.from("access_invitations").update({
      deleted_at: null,
      deleted_by_user_id: null,
      delete_reason: null,
      status: previousStatus(snapshot, accessStatuses, "cancelled"),
      updated_at: new Date().toISOString(),
    }).eq("id", item.entity_id);
    restoreError = error;
    successMessage = "Convite restaurado para a área de Matrículas.";
  } else if (item.entity_type === "enrollment_requests") {
    const { error } = await supabase.from("enrollment_requests").update({
      deleted_at: null,
      deleted_by_user_id: null,
      delete_reason: null,
      status: previousStatus(snapshot, requestStatuses, "new"),
      updated_at: new Date().toISOString(),
    }).eq("id", item.entity_id);
    restoreError = error;
    successMessage = "Solicitação de matrícula restaurada.";
  } else if (item.entity_type === "students") {
    const { error } = await supabase.from("students").update({
      deleted_at: null,
      deleted_by_user_id: null,
      delete_reason: null,
      status: previousStatus(snapshot, studentStatuses, "inactive"),
      updated_at: new Date().toISOString(),
    }).eq("id", item.entity_id);
    restoreError = error;
    successMessage = "Aluno restaurado com o mesmo ID e histórico.";
  } else if (item.entity_type === "teachers") {
    const profileId = z.string().uuid().safeParse(snapshot.profile_id);
    if (!profileId.success) redirect(`/admin/lixeira?erro=${encodeURIComponent("O registro do professor não possui um perfil válido para restauração.")}`);
    const shouldReactivate = snapshot.previous_active !== false;
    const { error: teacherError } = await supabase.from("teachers").update({ active: shouldReactivate }).eq("id", item.entity_id).eq("profile_id", profileId.data);
    if (teacherError) restoreError = teacherError;
    else if (snapshot.had_teacher_role === true) {
      const { error: roleError } = await supabase.from("user_roles").upsert({ user_id: profileId.data, role: "teacher" }, { onConflict: "user_id,role" });
      restoreError = roleError;
    }
    successMessage = shouldReactivate ? "Professor restaurado com o mesmo perfil, vínculos e acesso." : "Professor restaurado com o mesmo perfil e histórico, permanecendo desativado.";
  } else if (item.entity_type === "guardians") {
    const profileId = z.string().uuid().safeParse(snapshot.profile_id);
    if (!profileId.success) redirect(`/admin/lixeira?erro=${encodeURIComponent("O registro do responsável não possui um perfil válido para restauração.")}`);
    const shouldReactivate = snapshot.previous_active !== false;
    const { error: guardianError } = await supabase.from("guardians").update({ active: shouldReactivate }).eq("id", item.entity_id).eq("profile_id", profileId.data);
    if (guardianError) restoreError = guardianError;
    else if (snapshot.had_guardian_role === true) {
      const { error: roleError } = await supabase.from("user_roles").upsert({ user_id: profileId.data, role: "guardian" }, { onConflict: "user_id,role" });
      restoreError = roleError;
    }
    successMessage = shouldReactivate ? "Responsável restaurado com o mesmo perfil, filhos vinculados e acesso." : "Responsável restaurado com o mesmo perfil e histórico, permanecendo desativado.";
  } else if (item.entity_type === "messages") {
    const previousEditedAt = typeof snapshot.previous_edited_at === "string" ? snapshot.previous_edited_at : null;
    const { error } = await supabase.from("messages").update({
      deleted_at: null,
      edited_at: previousEditedAt,
    }).eq("id", item.entity_id).not("deleted_at", "is", null);
    restoreError = error;
    successMessage = "Mensagem restaurada na conversa com o mesmo ID.";
  } else {
    redirect(`/admin/lixeira?erro=${encodeURIComponent("Este tipo de registro ainda não possui restauração segura implementada.")}`);
  }

  if (restoreError) redirect(`/admin/lixeira?erro=${encodeURIComponent("Não foi possível restaurar o registro.")}`);

  const { error: trashError } = await supabase.from("trash_items").update({ restored_at: new Date().toISOString() }).eq("id", item.id).is("restored_at", null);
  if (trashError) redirect(`/admin/lixeira?erro=${encodeURIComponent("O registro foi restaurado, mas a Lixeira não conseguiu atualizar o status. Revise o item antes de repetir a ação.")}`);

  refreshOperationalPaths();
  redirect(`/admin/lixeira?sucesso=${encodeURIComponent(successMessage)}`);
}

export async function permanentlyDeleteTrashItem(formData: FormData) {
  await requireRole("admin");
  const trashId = z.string().uuid().safeParse(formData.get("trashId"));
  if (!trashId.success) return;

  const supabase = await createClient();
  const { data: item } = await supabase.from("trash_items").select("id,entity_type,entity_id,entity_snapshot,restored_at").eq("id", trashId.data).maybeSingle();
  if (!item || item.restored_at || !item.entity_id) redirect(`/admin/lixeira?erro=${encodeURIComponent("Item não encontrado.")}`);

  if (item.entity_type === "enrollment_requests") {
    const { error } = await supabase.from("enrollment_requests").delete().eq("id", item.entity_id).not("deleted_at", "is", null);
    if (error) redirect(`/admin/lixeira?erro=${encodeURIComponent("Não foi possível excluir permanentemente a solicitação.")}`);
  } else if (item.entity_type === "access_invitations") {
    const { data: invitation } = await supabase.from("access_invitations").select("id,status,auth_user_id,deleted_at").eq("id", item.entity_id).maybeSingle();
    if (!invitation) {
      // A entrada órfã da Lixeira pode ser removida.
    } else if (!invitation.deleted_at || invitation.auth_user_id || !["error", "cancelled"].includes(invitation.status)) {
      redirect(`/admin/lixeira?erro=${encodeURIComponent("Este convite possui acesso ou histórico que deve ser preservado. Use restauração ou mantenha-o na Lixeira.")}`);
    } else {
      const { error } = await supabase.from("access_invitations").delete().eq("id", invitation.id);
      if (error) redirect(`/admin/lixeira?erro=${encodeURIComponent("Não foi possível excluir permanentemente o convite.")}`);
    }
  } else {
    redirect(`/admin/lixeira?erro=${encodeURIComponent("Exclusão permanente bloqueada para este tipo de registro para preservar o histórico.")}`);
  }

  const { error: trashError } = await supabase.from("trash_items").delete().eq("id", item.id);
  if (trashError) redirect(`/admin/lixeira?erro=${encodeURIComponent("O registro foi removido, mas a entrada da Lixeira não pôde ser limpa.")}`);

  refreshOperationalPaths();
  redirect(`/admin/lixeira?sucesso=${encodeURIComponent("Registro excluído permanentemente com segurança.")}`);
}
