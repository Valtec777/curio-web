"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  title: z.string().trim().min(3).max(180),
  body: z.string().trim().min(3).max(5000),
  audience: z.enum(["all", "public", "guardians", "teachers", "students", "admins"]),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

function iso(value?: string) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function createAnnouncement(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = schema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    audience: formData.get("audience"),
    startsAt: String(formData.get("startsAt") || ""),
    endsAt: String(formData.get("endsAt") || ""),
  });
  if (!parsed.success) redirect("/admin/comunicacao?erro=" + encodeURIComponent("Revise o comunicado."));
  const startsAt = iso(parsed.data.startsAt);
  const endsAt = iso(parsed.data.endsAt);
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) redirect("/admin/comunicacao?erro=" + encodeURIComponent("A data final deve ser depois do início."));

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    title: parsed.data.title,
    body: parsed.data.body,
    audience: parsed.data.audience,
    active: formData.get("active") === "on",
    starts_at: startsAt,
    ends_at: endsAt,
    created_by_user_id: viewer.user.id,
  });
  if (error) redirect("/admin/comunicacao?erro=" + encodeURIComponent("Não foi possível publicar o comunicado."));
  revalidatePath("/admin/comunicacao");
  revalidatePath("/");
  revalidatePath("/familia");
  revalidatePath("/professor");
  revalidatePath("/aluno");
  redirect("/admin/comunicacao?sucesso=" + encodeURIComponent(formData.get("active") === "on" ? "Comunicado publicado no CURIÓ." : "Comunicado salvo como inativo."));
}

export async function setAnnouncementActive(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({ id: z.string().uuid(), active: z.enum(["true", "false"]) }).safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update({ active: parsed.data.active === "true", updated_at: new Date().toISOString() }).eq("id", parsed.data.id);
  if (error) redirect("/admin/comunicacao?erro=" + encodeURIComponent("Não foi possível atualizar o comunicado."));
  revalidatePath("/admin/comunicacao");
  revalidatePath("/");
  redirect("/admin/comunicacao?sucesso=" + encodeURIComponent(parsed.data.active === "true" ? "Comunicado ativado." : "Comunicado pausado."));
}
