"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function moveGuardianToTrash(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = z.object({
    guardianId: z.string().uuid(),
    reason: z.string().max(300).optional(),
  }).safeParse({
    guardianId: formData.get("guardianId"),
    reason: String(formData.get("reason") || ""),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: guardian } = await supabase
    .from("guardians")
    .select("id,profile_id,active,profiles(full_name,preferred_name,phone_whatsapp)")
    .eq("id", parsed.data.guardianId)
    .maybeSingle();

  if (!guardian) {
    redirect(`/admin/familias?erro=${encodeURIComponent("Responsável não encontrado.")}`);
  }

  const { data: existingTrash } = await supabase
    .from("trash_items")
    .select("id")
    .eq("entity_type", "guardians")
    .eq("entity_id", guardian.id)
    .is("restored_at", null)
    .maybeSingle();
  if (existingTrash) {
    redirect(`/admin/familias?erro=${encodeURIComponent("Este responsável já está na Lixeira.")}`);
  }

  const [{ count: studentLinks }, { count: subscriptions }, { data: roleRow }] = await Promise.all([
    supabase.from("guardian_students").select("student_id", { count: "exact", head: true }).eq("guardian_id", guardian.id),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("guardian_id", guardian.id),
    supabase.from("user_roles").select("user_id").eq("user_id", guardian.profile_id).eq("role", "guardian").maybeSingle(),
  ]);

  const now = new Date();
  const reason = parsed.data.reason?.trim() || "Removido pelo Admin";
  const profile = guardian.profiles as any;
  const { error: trashError } = await supabase.from("trash_items").insert({
    entity_type: "guardians",
    entity_id: guardian.id,
    entity_snapshot: {
      label: profile?.preferred_name || profile?.full_name || "Responsável",
      profile_id: guardian.profile_id,
      phone_whatsapp: profile?.phone_whatsapp || null,
      previous_active: guardian.active,
      had_guardian_role: Boolean(roleRow),
      reason,
      dependencies: {
        guardian_students: studentLinks ?? 0,
        subscriptions: subscriptions ?? 0,
      },
    },
    deleted_by_user_id: viewer.user.id,
    deleted_at: now.toISOString(),
    restore_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (trashError && trashError.code !== "23505") {
    redirect(`/admin/familias?erro=${encodeURIComponent("Não foi possível enviar o responsável para a Lixeira.")}`);
  }

  const { error: guardianError } = await supabase
    .from("guardians")
    .update({ active: false })
    .eq("id", guardian.id);
  if (guardianError) {
    redirect(`/admin/familias?erro=${encodeURIComponent("A Lixeira foi registrada, mas não foi possível retirar o acesso da família. Revise antes de repetir.")}`);
  }

  const { error: roleError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", guardian.profile_id)
    .eq("role", "guardian");
  if (roleError) {
    redirect(`/admin/familias?erro=${encodeURIComponent("O responsável foi desativado, mas o papel de família não pôde ser retirado. Revise o acesso.")}`);
  }

  revalidatePath("/admin/familias");
  revalidatePath("/admin/lixeira");
  revalidatePath("/admin/usuarios");
  revalidatePath("/familia");
  redirect(`/admin/familias?sucesso=${encodeURIComponent("Responsável enviado para a Lixeira. Filhos, plano e histórico foram preservados.")}`);
}
