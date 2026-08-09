"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

type ResourceKind = "material" | "notebook" | "assessment";

const config: Record<ResourceKind, { table: string; relation: string; relationKey: string; returnPath: string }> = {
  material: { table: "materials", relation: "material_assignments", relationKey: "material_id", returnPath: "/professor/materiais" },
  notebook: { table: "notebook_activities", relation: "notebook_assignments", relationKey: "activity_id", returnPath: "/professor/materiais" },
  assessment: { table: "assessments", relation: "assessment_students", relationKey: "assessment_id", returnPath: "/professor/avaliacoes" },
};

const resourceSchema = z.object({
  kind: z.enum(["material", "notebook", "assessment"]),
  id: z.string().uuid(),
});

function parseBase(formData: FormData) {
  return resourceSchema.safeParse({ kind: formData.get("kind"), id: formData.get("id") });
}

export async function updateTeacherResource(formData: FormData) {
  const parsed = parseBase(formData);
  if (!parsed.success) return;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect(config[parsed.data.kind].returnPath);
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (title.length < 2) redirect(`${config[parsed.data.kind].returnPath}?erro=${encodeURIComponent("Informe um título.")}`);
  const row = parsed.data.kind === "assessment"
    ? { title, instructions: description || null, updated_at: new Date().toISOString() }
    : { title, description: description || "Sem descrição.", updated_at: new Date().toISOString() };
  const { error } = await supabase.from(config[parsed.data.kind].table).update(row).eq("id", parsed.data.id).eq("created_by_teacher_id", teacher.id);
  if (error) redirect(`${config[parsed.data.kind].returnPath}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(config[parsed.data.kind].returnPath);
  redirect(`${config[parsed.data.kind].returnPath}?sucesso=${encodeURIComponent("Item atualizado.")}`);
}

export async function setTeacherResourceStatus(formData: FormData) {
  const parsed = resourceSchema.extend({ status: z.enum(["draft", "published", "archived"]) }).safeParse({
    kind: formData.get("kind"), id: formData.get("id"), status: formData.get("status"),
  });
  if (!parsed.success) return;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect(config[parsed.data.kind].returnPath);
  const { error } = await supabase.from(config[parsed.data.kind].table).update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("created_by_teacher_id", teacher.id);
  if (error) redirect(`${config[parsed.data.kind].returnPath}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(config[parsed.data.kind].returnPath);
  redirect(`${config[parsed.data.kind].returnPath}?sucesso=${encodeURIComponent(parsed.data.status === "archived" ? "Item arquivado." : "Situação atualizada.")}`);
}

export async function removeTeacherResource(formData: FormData) {
  const parsed = parseBase(formData);
  if (!parsed.success) return;
  const cfg = config[parsed.data.kind];
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect(cfg.returnPath);
  const { data: item } = await supabase.from(cfg.table).select("id,status,created_by_teacher_id").eq("id", parsed.data.id).maybeSingle();
  if (!item || item.created_by_teacher_id !== teacher.id) redirect(`${cfg.returnPath}?erro=${encodeURIComponent("Item não encontrado.")}`);
  const { count } = await supabase.from(cfg.relation).select("id", { count: "exact", head: true }).eq(cfg.relationKey, parsed.data.id);
  if ((count ?? 0) > 0 || item.status !== "draft") {
    await supabase.from(cfg.table).update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", parsed.data.id);
    revalidatePath(cfg.returnPath);
    redirect(`${cfg.returnPath}?sucesso=${encodeURIComponent("O item já tinha vínculo/histórico e foi arquivado em vez de apagado.")}`);
  }
  const { error } = await supabase.from(cfg.table).delete().eq("id", parsed.data.id).eq("created_by_teacher_id", teacher.id);
  if (error) redirect(`${cfg.returnPath}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(cfg.returnPath);
  redirect(`${cfg.returnPath}?sucesso=${encodeURIComponent("Rascunho excluído.")}`);
}
