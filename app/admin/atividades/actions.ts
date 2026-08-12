"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const contentKindSchema = z.object({
  kind: z.enum(["mission", "material", "notebook", "assessment"]),
  id: z.string().uuid(),
  reason: z.string().max(300).optional(),
});

const contentConfig = {
  mission: { table: "missions", relation: "mission_students", relationKey: "mission_id" },
  material: { table: "materials", relation: "material_assignments", relationKey: "material_id" },
  notebook: { table: "notebook_activities", relation: "notebook_assignments", relationKey: "activity_id" },
  assessment: { table: "assessments", relation: "assessment_students", relationKey: "assessment_id" },
} as const;

export async function moveAdminContentToTrash(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = contentKindSchema.safeParse({
    kind: formData.get("kind"),
    id: formData.get("id"),
    reason: String(formData.get("reason") || ""),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const cfg = contentConfig[parsed.data.kind];
  const { data: item, error: itemError } = await supabase
    .from(cfg.table)
    .select("id,title,status,updated_at")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (itemError || !item) {
    redirect(`/admin/atividades?erro=${encodeURIComponent("Item não encontrado.")}`);
  }

  const { count, error: countError } = await supabase
    .from(cfg.relation)
    .select("*", { count: "exact", head: true })
    .eq(cfg.relationKey, item.id);
  if (countError) {
    redirect(`/admin/atividades?erro=${encodeURIComponent("Não foi possível verificar os vínculos do item antes da exclusão.")}`);
  }

  const now = new Date();
  const reason = parsed.data.reason?.trim() || "Removido pelo Admin";
  const { error: trashError } = await supabase.from("trash_items").insert({
    entity_type: cfg.table,
    entity_id: item.id,
    entity_snapshot: {
      label: item.title,
      kind: parsed.data.kind,
      previous_status: item.status,
      previous_updated_at: item.updated_at,
      dependency_count: count ?? 0,
      reason,
    },
    deleted_by_user_id: viewer.user.id,
    deleted_at: now.toISOString(),
    restore_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (trashError?.code === "23505") {
    redirect(`/admin/atividades?erro=${encodeURIComponent("Este item já está na Lixeira.")}`);
  }
  if (trashError) {
    redirect(`/admin/atividades?erro=${encodeURIComponent("Não foi possível enviar o item para a Lixeira.")}`);
  }

  const { error: archiveError } = await supabase
    .from(cfg.table)
    .update({ status: "archived", updated_at: now.toISOString() })
    .eq("id", item.id);

  if (archiveError) {
    await supabase.from("trash_items").delete().eq("entity_type", cfg.table).eq("entity_id", item.id).is("restored_at", null);
    redirect(`/admin/atividades?erro=${encodeURIComponent("O item não foi removido da operação. Nenhuma entrada incompleta foi mantida na Lixeira.")}`);
  }

  revalidatePath("/admin/atividades");
  revalidatePath("/admin/lixeira");
  revalidatePath("/professor/missoes");
  revalidatePath("/professor/materiais");
  revalidatePath("/professor/avaliacoes");
  revalidatePath("/aluno");
  revalidatePath("/familia");
  redirect(`/admin/atividades?sucesso=${encodeURIComponent("Item removido da operação e enviado para a Lixeira. O histórico foi preservado.")}`);
}
