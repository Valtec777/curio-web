"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const occurrenceSchema = z.object({
  studentId: z.string().uuid(),
  type: z.enum(["observation","positive","attention","behavior","attendance","other"]),
  title: z.string().min(2).max(120),
  description: z.string().min(3).max(2000),
  severity: z.coerce.number().int().min(1).max(3),
});

export async function createOccurrence(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = occurrenceSchema.safeParse({
    studentId: formData.get("studentId"),
    type: formData.get("type"),
    title: formData.get("title"),
    description: formData.get("description"),
    severity: formData.get("severity"),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("student_occurrences").insert({
    student_id: parsed.data.studentId,
    occurrence_type: parsed.data.type,
    title: parsed.data.title,
    description: parsed.data.description,
    severity: parsed.data.severity,
    created_by_user_id: viewer.user.id,
  });
  revalidatePath("/admin/ocorrencias");
}

const mediaSchema = z.object({
  name: z.string().min(2).max(140),
  category: z.string().min(2).max(40),
  filePath: z.string().optional(),
  externalUrl: z.string().optional(),
  altText: z.string().max(240).optional(),
}).refine((data) => Boolean(data.filePath?.trim() || data.externalUrl?.trim()), "Informe um caminho ou URL.");

export async function registerMediaAsset(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = mediaSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    filePath: String(formData.get("filePath") || ""),
    externalUrl: String(formData.get("externalUrl") || ""),
    altText: String(formData.get("altText") || ""),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("media_assets").insert({
    name: parsed.data.name,
    category: parsed.data.category,
    file_path: parsed.data.filePath?.trim() || null,
    external_url: parsed.data.externalUrl?.trim() || null,
    alt_text: parsed.data.altText?.trim() || null,
    created_by_user_id: viewer.user.id,
  });
  revalidatePath("/admin/midia");
}

const ticketStatusSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(["open","in_progress","waiting","resolved","closed"]),
});

export async function updateSupportTicketStatus(formData: FormData) {
  await requireRole("admin");
  const parsed = ticketStatusSchema.safeParse({ ticketId: formData.get("ticketId"), status: formData.get("status") });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("support_tickets").update({
    status: parsed.data.status,
    closed_at: ["resolved","closed"].includes(parsed.data.status) ? new Date().toISOString() : null,
  }).eq("id", parsed.data.ticketId);
  revalidatePath("/admin/suporte");
}

const gradingSchema = z.object({
  name: z.string().min(2).max(100),
  min: z.coerce.number(),
  max: z.coerce.number(),
  passing: z.coerce.number().optional(),
}).refine((data) => data.max > data.min, "A nota máxima deve ser maior que a mínima.");

export async function createGradingScheme(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = gradingSchema.safeParse({
    name: formData.get("name"),
    min: formData.get("min"),
    max: formData.get("max"),
    passing: formData.get("passing") || undefined,
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("grading_schemes").insert({
    name: parsed.data.name,
    scale_min: parsed.data.min,
    scale_max: parsed.data.max,
    passing_score: parsed.data.passing ?? null,
    created_by_user_id: viewer.user.id,
  });
  revalidatePath("/admin/notas");
}

const gradingBandSchema = z.object({
  schemeId: z.string().uuid(),
  label: z.string().min(2).max(80),
  min: z.coerce.number(),
  max: z.coerce.number(),
  color: z.enum(["pink","yellow","blue","green","neutral"]),
}).refine((data) => data.max >= data.min, "Faixa inválida.");

export async function addGradingBand(formData: FormData) {
  await requireRole("admin");
  const parsed = gradingBandSchema.safeParse({
    schemeId: formData.get("schemeId"),
    label: formData.get("label"),
    min: formData.get("min"),
    max: formData.get("max"),
    color: formData.get("color"),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { count } = await supabase.from("grading_bands").select("id", { count: "exact", head: true }).eq("scheme_id", parsed.data.schemeId);
  await supabase.from("grading_bands").insert({
    scheme_id: parsed.data.schemeId,
    label: parsed.data.label,
    min_score: parsed.data.min,
    max_score: parsed.data.max,
    color_key: parsed.data.color,
    sort_order: (count ?? 0) + 1,
  });
  revalidatePath("/admin/notas");
}

const occurrenceStatusSchema = z.object({
  occurrenceId: z.string().uuid(),
  status: z.enum(["open","monitoring","resolved"]),
});

export async function updateOccurrenceStatus(formData: FormData) {
  await requireRole("admin");
  const parsed = occurrenceStatusSchema.safeParse({ occurrenceId: formData.get("occurrenceId"), status: formData.get("status") });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("student_occurrences").update({
    status: parsed.data.status,
    resolved_at: parsed.data.status === "resolved" ? new Date().toISOString() : null,
  }).eq("id", parsed.data.occurrenceId);
  revalidatePath("/admin/ocorrencias");
}

const mascotSchema = z.object({
  characterId: z.string().uuid(),
  trait: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  principal: z.string().max(500).optional(),
  avatar: z.string().max(500).optional(),
  sticker: z.string().max(500).optional(),
  activity: z.string().max(500).optional(),
  thinking: z.string().max(500).optional(),
});

export async function updateMascot(formData: FormData) {
  await requireRole("admin");
  const parsed = mascotSchema.safeParse({
    characterId: formData.get("characterId"),
    trait: formData.get("trait"),
    description: String(formData.get("description") || ""),
    principal: String(formData.get("principal") || ""),
    avatar: String(formData.get("avatar") || ""),
    sticker: String(formData.get("sticker") || ""),
    activity: String(formData.get("activity") || ""),
    thinking: String(formData.get("thinking") || ""),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { data: current } = await supabase.from("characters").select("assets").eq("id", parsed.data.characterId).maybeSingle();
  const assets: Record<string, string> = { ...(current?.assets || {}) };
  for (const key of ["principal", "avatar", "sticker", "activity", "thinking"] as const) {
    const value = parsed.data[key]?.trim();
    if (value) assets[key] = value;
    else delete assets[key];
  }
  await supabase.from("characters").update({
    pedagogical_trait: parsed.data.trait,
    description: parsed.data.description?.trim() || null,
    assets,
    active: formData.get("active") === "on",
  }).eq("id", parsed.data.characterId);
  revalidatePath("/admin/mascotes");
}


const institutionalInviteSchema = z.object({
  fullName: z.string().min(2, "Informe o nome completo."),
  preferredName: z.string().optional(),
  email: z.string().email("Informe um e-mail válido."),
  phone: z.string().optional(),
});

async function currentOrigin() {
  const h = await headers();
  return (h.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function invokeAccessAdmin(body: Record<string, unknown>) {
  await requireRole("admin");
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("curio-access-admin", { body });
  if (error || data?.error) return { ok: false, message: data?.error || "Não foi possível enviar o acesso agora." };
  return { ok: true, data };
}

export async function inviteGuardianEnrollment(formData: FormData) {
  const parsed = institutionalInviteSchema.extend({
    childName: z.string().min(2, "Informe o nome do aluno."),
    childPreferredName: z.string().optional(),
    gradeId: z.string().uuid().optional().or(z.literal("")),
    schoolName: z.string().optional(),
    relationship: z.string().min(2).default("Responsável"),
  }).safeParse({
    fullName: formData.get("fullName"),
    preferredName: String(formData.get("preferredName") || ""),
    email: formData.get("email"),
    phone: String(formData.get("phone") || ""),
    childName: formData.get("childName"),
    childPreferredName: String(formData.get("childPreferredName") || ""),
    gradeId: String(formData.get("gradeId") || ""),
    schoolName: String(formData.get("schoolName") || ""),
    relationship: String(formData.get("relationship") || "Responsável"),
  });
  if (!parsed.success) redirect(`/admin/matriculas?erro=${encodeURIComponent(parsed.error.issues[0].message)}`);

  const result = await invokeAccessAdmin({
    action: "invite",
    role: "guardian",
    full_name: parsed.data.fullName,
    preferred_name: parsed.data.preferredName || null,
    email: parsed.data.email,
    phone_whatsapp: parsed.data.phone || null,
    relationship: parsed.data.relationship,
    origin: await currentOrigin(),
    student: {
      full_name: parsed.data.childName,
      preferred_name: parsed.data.childPreferredName || parsed.data.childName,
      grade_id: parsed.data.gradeId || null,
      school_name: parsed.data.schoolName || null,
      status: "active",
    },
  });
  if (!result.ok) redirect(`/admin/matriculas?erro=${encodeURIComponent(result.message || "Falha ao liberar acesso.")}`);
  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/familias");
  revalidatePath("/admin/alunos");
  redirect(`/admin/matriculas?sucesso=${encodeURIComponent("Matrícula criada e acesso da família enviado por e-mail.")}`);
}

export async function inviteTeacherAccess(formData: FormData) {
  const parsed = institutionalInviteSchema.safeParse({
    fullName: formData.get("fullName"),
    preferredName: String(formData.get("preferredName") || ""),
    email: formData.get("email"),
    phone: String(formData.get("phone") || ""),
  });
  if (!parsed.success) redirect(`/admin/professores?erro=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const result = await invokeAccessAdmin({
    action: "invite",
    role: "teacher",
    full_name: parsed.data.fullName,
    preferred_name: parsed.data.preferredName || null,
    email: parsed.data.email,
    phone_whatsapp: parsed.data.phone || null,
    origin: await currentOrigin(),
  });
  if (!result.ok) redirect(`/admin/professores?erro=${encodeURIComponent(result.message || "Falha ao liberar acesso.")}`);
  revalidatePath("/admin/professores");
  redirect(`/admin/professores?sucesso=${encodeURIComponent("Professor cadastrado e convite de acesso enviado.")}`);
}

export async function inviteAdminAccess(formData: FormData) {
  const parsed = institutionalInviteSchema.safeParse({
    fullName: formData.get("fullName"),
    preferredName: String(formData.get("preferredName") || ""),
    email: formData.get("email"),
    phone: String(formData.get("phone") || ""),
  });
  if (!parsed.success) redirect(`/admin/usuarios?erro=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const safeReturn = parsed.data.returnTo?.startsWith("/admin/") ? parsed.data.returnTo : "/admin/usuarios";
  const result = await invokeAccessAdmin({
    action: "invite",
    role: "admin",
    full_name: parsed.data.fullName,
    preferred_name: parsed.data.preferredName || null,
    email: parsed.data.email,
    phone_whatsapp: parsed.data.phone || null,
    origin: await currentOrigin(),
  });
  if (!result.ok) redirect(`/admin/usuarios?erro=${encodeURIComponent(result.message || "Falha ao liberar acesso.")}`);
  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?sucesso=${encodeURIComponent("Novo administrador convidado com sucesso.")}`);
}

export async function resendAccessInvitation(formData: FormData) {
  const invitationId = String(formData.get("invitationId") || "");
  const returnTo = String(formData.get("returnTo") || "/admin/usuarios");
  if (!z.string().uuid().safeParse(invitationId).success) return;
  const safeReturn = returnTo.startsWith("/admin/") ? returnTo : "/admin/usuarios";
  const result = await invokeAccessAdmin({
    action: "resend",
    invitation_id: invitationId,
    origin: await currentOrigin(),
  });
  if (!result.ok) redirect(`${safeReturn}?erro=${encodeURIComponent(result.message || "Não foi possível reenviar o acesso.")}`);
  revalidatePath(safeReturn);
  redirect(`${safeReturn}?sucesso=${encodeURIComponent("Novo link enviado para o e-mail cadastrado.")}`);
}


const adminProfileSchema = z.object({
  profileId: z.string().uuid(),
  returnTo: z.string().optional(),
  fullName: z.string().min(2).max(140),
  preferredName: z.string().max(100).optional(),
  phone: z.string().max(40).optional(),
});

export async function updateUserProfileAdmin(formData: FormData) {
  await requireRole("admin");
  const parsed = adminProfileSchema.safeParse({
    profileId: formData.get("profileId"),
    returnTo: String(formData.get("returnTo") || "/admin/usuarios"),
    fullName: formData.get("fullName"),
    preferredName: String(formData.get("preferredName") || ""),
    phone: String(formData.get("phone") || ""),
  });
  if (!parsed.success) redirect(`/admin/usuarios?erro=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const requestedReturn = parsed.data.returnTo || "/admin/usuarios";
  const safeReturn = requestedReturn.startsWith("/admin/") ? requestedReturn : "/admin/usuarios";
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({
    full_name: parsed.data.fullName,
    preferred_name: parsed.data.preferredName?.trim() || null,
    phone_whatsapp: parsed.data.phone?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.profileId);
  if (error) redirect(`${safeReturn}?erro=${encodeURIComponent("Não foi possível atualizar o perfil.")}`);
  await supabase.from("teachers").update({ phone_whatsapp: parsed.data.phone?.trim() || null }).eq("profile_id", parsed.data.profileId);
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/professores");
  revalidatePath("/admin/familias");
  redirect(`${safeReturn}?sucesso=${encodeURIComponent("Perfil atualizado.")}`);
}

const commercialPlanSchema = z.object({
  planId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().min(3).max(140),
  description: z.string().min(3).max(600),
  monthlyPrice: z.coerce.number().min(0).max(99999),
  meetingsPerMonth: z.coerce.number().int().min(0).max(60),
  deliveryMode: z.string().min(2).max(40),
  badge: z.string().max(40).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  features: z.string().max(2000).optional(),
});

function planFeatures(value?: string) {
  return (value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function createCommercialPlan(formData: FormData) {
  await requireRole("admin");
  const parsed = commercialPlanSchema.safeParse({
    planId: "",
    name: formData.get("name"),
    description: formData.get("description"),
    monthlyPrice: formData.get("monthlyPrice"),
    meetingsPerMonth: formData.get("meetingsPerMonth"),
    deliveryMode: formData.get("deliveryMode") || "online",
    badge: String(formData.get("badge") || ""),
    sortOrder: formData.get("sortOrder") || 0,
    features: String(formData.get("features") || ""),
  });
  if (!parsed.success) redirect(`/admin/planos?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Revise o plano.")}`);
  const supabase = await createClient();
  const { error } = await supabase.from("plans").insert({
    name: parsed.data.name,
    description: parsed.data.description,
    monthly_price: parsed.data.monthlyPrice,
    currency: "BRL",
    billing_interval: "monthly",
    meetings_per_month: parsed.data.meetingsPerMonth,
    delivery_mode: parsed.data.deliveryMode,
    badge: parsed.data.badge?.trim() || null,
    sort_order: parsed.data.sortOrder,
    features: planFeatures(parsed.data.features),
    active: formData.get("active") === "on",
    visible_on_landing: formData.get("visibleOnLanding") === "on",
    available_for_enrollment: formData.get("availableForEnrollment") === "on",
    archived_at: null,
    deleted_at: null,
  });
  if (error) redirect(`/admin/planos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/planos");
  redirect(`/admin/planos?sucesso=${encodeURIComponent("Plano criado.")}`);
}

export async function updateCommercialPlan(formData: FormData) {
  await requireRole("admin");
  const parsed = commercialPlanSchema.safeParse({
    planId: formData.get("planId"),
    name: formData.get("name"),
    description: formData.get("description"),
    monthlyPrice: formData.get("monthlyPrice"),
    meetingsPerMonth: formData.get("meetingsPerMonth"),
    deliveryMode: formData.get("deliveryMode") || "online",
    badge: String(formData.get("badge") || ""),
    sortOrder: formData.get("sortOrder") || 0,
    features: String(formData.get("features") || ""),
  });
  if (!parsed.success || !parsed.data.planId) redirect(`/admin/planos?erro=${encodeURIComponent(parsed.success ? "Plano inválido." : parsed.error.issues[0]?.message || "Revise o plano.")}`);
  const supabase = await createClient();
  const { error } = await supabase.from("plans").update({
    name: parsed.data.name,
    description: parsed.data.description,
    monthly_price: parsed.data.monthlyPrice,
    meetings_per_month: parsed.data.meetingsPerMonth,
    delivery_mode: parsed.data.deliveryMode,
    badge: parsed.data.badge?.trim() || null,
    sort_order: parsed.data.sortOrder,
    features: planFeatures(parsed.data.features),
    active: formData.get("active") === "on",
    visible_on_landing: formData.get("visibleOnLanding") === "on",
    available_for_enrollment: formData.get("availableForEnrollment") === "on",
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.planId).is("deleted_at", null);
  if (error) redirect(`/admin/planos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/planos");
  revalidatePath("/");
  redirect(`/admin/planos?sucesso=${encodeURIComponent("Plano atualizado.")}`);
}

const planLifecycleSchema = z.object({
  planId: z.string().uuid(),
  action: z.enum(["activate", "draft", "archive", "delete"]),
});

export async function manageCommercialPlan(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = planLifecycleSchema.safeParse({ planId: formData.get("planId"), action: formData.get("action") });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("id,name,description,monthly_price,active,archived_at,deleted_at").eq("id", parsed.data.planId).maybeSingle();
  if (!plan || plan.deleted_at) redirect(`/admin/planos?erro=${encodeURIComponent("Plano não encontrado.")}`);

  if (parsed.data.action === "activate") {
    await supabase.from("plans").update({ active: true, archived_at: null, updated_at: new Date().toISOString() }).eq("id", plan.id);
  } else if (parsed.data.action === "draft") {
    await supabase.from("plans").update({ active: false, archived_at: null, visible_on_landing: false, updated_at: new Date().toISOString() }).eq("id", plan.id);
  } else if (parsed.data.action === "archive") {
    await supabase.from("plans").update({ active: false, archived_at: new Date().toISOString(), visible_on_landing: false, available_for_enrollment: false, updated_at: new Date().toISOString() }).eq("id", plan.id);
  } else {
    const { count } = await supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("plan_id", plan.id);
    if ((count ?? 0) > 0) {
      await supabase.from("plans").update({ active: false, archived_at: new Date().toISOString(), visible_on_landing: false, available_for_enrollment: false, updated_at: new Date().toISOString() }).eq("id", plan.id);
      revalidatePath("/admin/planos");
      redirect(`/admin/planos?sucesso=${encodeURIComponent("O plano possui assinaturas e foi arquivado para preservar o histórico financeiro.")}`);
    }
    const now = new Date();
    await supabase.from("trash_items").insert({
      entity_type: "plans",
      entity_id: plan.id,
      entity_snapshot: { label: plan.name, description: plan.description, monthly_price: plan.monthly_price, active: plan.active, archived_at: plan.archived_at },
      deleted_by_user_id: viewer.user.id,
      deleted_at: now.toISOString(),
      restore_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await supabase.from("plans").update({ deleted_at: now.toISOString(), deleted_by_user_id: viewer.user.id, active: false, visible_on_landing: false, available_for_enrollment: false, updated_at: now.toISOString() }).eq("id", plan.id);
  }
  revalidatePath("/admin/planos");
  revalidatePath("/admin/lixeira");
  revalidatePath("/");
  redirect(`/admin/planos?sucesso=${encodeURIComponent(parsed.data.action === "delete" ? "Plano movido para a Lixeira." : "Situação do plano atualizada.")}`);
}

export async function restoreTrashItem(formData: FormData) {
  await requireRole("admin");
  const trashId = String(formData.get("trashId") || "");
  if (!z.string().uuid().safeParse(trashId).success) return;
  const supabase = await createClient();
  const { data: item } = await supabase.from("trash_items").select("id,entity_type,entity_id,restored_at,restore_until").eq("id", trashId).maybeSingle();
  if (!item || item.restored_at || !item.entity_id) return;
  if (item.restore_until && new Date(item.restore_until).getTime() < Date.now()) redirect(`/admin/lixeira?erro=${encodeURIComponent("O prazo de restauração terminou.")}`);
  if (item.entity_type === "plans") {
    await supabase.from("plans").update({ deleted_at: null, deleted_by_user_id: null, active: false, archived_at: null, visible_on_landing: false, updated_at: new Date().toISOString() }).eq("id", item.entity_id);
    await supabase.from("trash_items").update({ restored_at: new Date().toISOString() }).eq("id", item.id);
    revalidatePath("/admin/planos");
    revalidatePath("/admin/lixeira");
    redirect(`/admin/lixeira?sucesso=${encodeURIComponent("Plano restaurado como rascunho.")}`);
  }
}

const adminContentKindSchema = z.object({
  kind: z.enum(["mission", "material", "notebook", "assessment"]),
  id: z.string().uuid(),
});

const adminContentConfig = {
  mission: { table: "missions", relation: "mission_students", relationKey: "mission_id" },
  material: { table: "materials", relation: "material_assignments", relationKey: "material_id" },
  notebook: { table: "notebook_activities", relation: "notebook_assignments", relationKey: "activity_id" },
  assessment: { table: "assessments", relation: "assessment_students", relationKey: "assessment_id" },
} as const;

export async function updateAdminContentItem(formData: FormData) {
  await requireRole("admin");
  const parsed = adminContentKindSchema.safeParse({ kind: formData.get("kind"), id: formData.get("id") });
  if (!parsed.success) return;
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (title.length < 2) redirect(`/admin/atividades?erro=${encodeURIComponent("Informe um título.")}`);
  const supabase = await createClient();
  const cfg = adminContentConfig[parsed.data.kind];
  const payload = parsed.data.kind === "mission"
    ? { title, objective: description || "Objetivo a revisar", updated_at: new Date().toISOString() }
    : parsed.data.kind === "assessment"
      ? { title, instructions: description || null, updated_at: new Date().toISOString() }
      : { title, description: description || "Sem descrição.", updated_at: new Date().toISOString() };
  const { error } = await supabase.from(cfg.table).update(payload).eq("id", parsed.data.id);
  if (error) redirect(`/admin/atividades?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/atividades");
  redirect(`/admin/atividades?sucesso=${encodeURIComponent("Item atualizado.")}`);
}

export async function setAdminContentStatus(formData: FormData) {
  await requireRole("admin");
  const parsed = adminContentKindSchema.extend({ status: z.enum(["draft", "published", "archived"]) }).safeParse({ kind: formData.get("kind"), id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return;
  const supabase = await createClient();
  const cfg = adminContentConfig[parsed.data.kind];
  const { error } = await supabase.from(cfg.table).update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq("id", parsed.data.id);
  if (error) redirect(`/admin/atividades?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/atividades");
  redirect(`/admin/atividades?sucesso=${encodeURIComponent(parsed.data.status === "archived" ? "Item arquivado." : "Situação atualizada.")}`);
}

export async function removeAdminContentItem(formData: FormData) {
  await requireRole("admin");
  const parsed = adminContentKindSchema.safeParse({ kind: formData.get("kind"), id: formData.get("id") });
  if (!parsed.success) return;
  const supabase = await createClient();
  const cfg = adminContentConfig[parsed.data.kind];
  const { data: item } = await supabase.from(cfg.table).select("id,status").eq("id", parsed.data.id).maybeSingle();
  if (!item) redirect(`/admin/atividades?erro=${encodeURIComponent("Item não encontrado.")}`);
  const { count } = await supabase.from(cfg.relation).select("id", { count: "exact", head: true }).eq(cfg.relationKey, parsed.data.id);
  if (item.status !== "draft" || (count ?? 0) > 0) {
    await supabase.from(cfg.table).update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", parsed.data.id);
    revalidatePath("/admin/atividades");
    redirect(`/admin/atividades?sucesso=${encodeURIComponent("O item já tinha publicação ou vínculo e foi arquivado para preservar o histórico.")}`);
  }
  const { error } = await supabase.from(cfg.table).delete().eq("id", parsed.data.id);
  if (error) redirect(`/admin/atividades?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/atividades");
  redirect(`/admin/atividades?sucesso=${encodeURIComponent("Rascunho excluído.")}`);
}


function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}

const courseSchema = z.object({
  courseId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().min(3).max(160),
  slug: z.string().max(100).optional(),
  summary: z.string().max(300).optional(),
  description: z.string().max(3000).optional(),
  audienceLabel: z.string().max(120).optional(),
  estimatedMinutes: z.coerce.number().int().min(1).max(100000),
});

export async function createFreeCourse(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = courseSchema.safeParse({
    title: formData.get("title"), slug: String(formData.get("slug") || ""), summary: String(formData.get("summary") || ""),
    description: String(formData.get("description") || ""), audienceLabel: String(formData.get("audienceLabel") || ""),
    estimatedMinutes: formData.get("estimatedMinutes"),
  });
  if (!parsed.success) redirect(`/admin/cursos?erro=${encodeURIComponent("Confira os dados do curso.")}`);
  const supabase = await createClient();
  const slug = slugify(parsed.data.slug?.trim() || parsed.data.title);
  const { error } = await supabase.from("free_courses").insert({
    title: parsed.data.title.trim(), slug, summary: parsed.data.summary?.trim() || null, description: parsed.data.description?.trim() || null,
    audience_label: parsed.data.audienceLabel?.trim() || "Crianças e adolescentes", estimated_minutes: parsed.data.estimatedMinutes,
    certificate_enabled: formData.get("certificateEnabled") === "on", status: "draft", created_by_user_id: viewer.user.id,
  });
  if (error) redirect(`/admin/cursos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/cursos");
  redirect(`/admin/cursos?sucesso=${encodeURIComponent("Curso criado como rascunho.")}`);
}

export async function updateFreeCourse(formData: FormData) {
  await requireRole("admin");
  const parsed = courseSchema.safeParse({
    courseId: formData.get("courseId"), title: formData.get("title"), slug: String(formData.get("slug") || ""),
    summary: String(formData.get("summary") || ""), description: String(formData.get("description") || ""),
    audienceLabel: String(formData.get("audienceLabel") || ""), estimatedMinutes: formData.get("estimatedMinutes"),
  });
  if (!parsed.success || !parsed.data.courseId) redirect(`/admin/cursos?erro=${encodeURIComponent("Curso inválido.")}`);
  const supabase = await createClient();
  const { error } = await supabase.from("free_courses").update({
    title: parsed.data.title.trim(), slug: slugify(parsed.data.slug?.trim() || parsed.data.title), summary: parsed.data.summary?.trim() || null,
    description: parsed.data.description?.trim() || null, audience_label: parsed.data.audienceLabel?.trim() || "Crianças e adolescentes",
    estimated_minutes: parsed.data.estimatedMinutes, certificate_enabled: formData.get("certificateEnabled") === "on", updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.courseId);
  if (error) redirect(`/admin/cursos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/cursos");
  revalidatePath("/aluno/modo-pensar");
  redirect(`/admin/cursos?sucesso=${encodeURIComponent("Curso atualizado.")}`);
}

export async function setFreeCourseStatus(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({ courseId: z.string().uuid(), status: z.enum(["draft","published","archived"]) }).safeParse({ courseId: formData.get("courseId"), status: formData.get("status") });
  if (!parsed.success) return;
  const supabase = await createClient();
  if (parsed.data.status === "published") {
    const { count } = await supabase.from("free_course_modules").select("id", { count: "exact", head: true }).eq("course_id", parsed.data.courseId);
    if (!count) redirect(`/admin/cursos?erro=${encodeURIComponent("Adicione pelo menos uma etapa antes de publicar.")}`);
  }
  const { error } = await supabase.from("free_courses").update({ status: parsed.data.status, published_at: parsed.data.status === "published" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", parsed.data.courseId);
  if (error) redirect(`/admin/cursos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/cursos"); revalidatePath("/aluno/modo-pensar");
  redirect(`/admin/cursos?sucesso=${encodeURIComponent(parsed.data.status === "published" ? "Curso publicado." : parsed.data.status === "archived" ? "Curso arquivado." : "Curso voltou para rascunho.")}`);
}

const courseModuleSchema = z.object({
  moduleId: z.string().uuid().optional().or(z.literal("")), courseId: z.string().uuid(), title: z.string().min(2).max(160),
  description: z.string().max(500).optional(), body: z.string().max(12000).optional(), resourceType: z.enum(["lesson","video","link","download","practice"]),
  externalUrl: z.string().max(1000).optional(), filePath: z.string().max(1000).optional(), position: z.coerce.number().int().min(1).max(999), durationMinutes: z.coerce.number().int().min(1).max(10000),
});

export async function saveFreeCourseModule(formData: FormData) {
  await requireRole("admin");
  const parsed = courseModuleSchema.safeParse({
    moduleId: String(formData.get("moduleId") || ""), courseId: formData.get("courseId"), title: formData.get("title"),
    description: String(formData.get("description") || ""), body: String(formData.get("body") || ""), resourceType: formData.get("resourceType"),
    externalUrl: String(formData.get("externalUrl") || ""), filePath: String(formData.get("filePath") || ""), position: formData.get("position"), durationMinutes: formData.get("durationMinutes"),
  });
  if (!parsed.success) redirect(`/admin/cursos?erro=${encodeURIComponent("Confira os dados da etapa.")}`);
  const supabase = await createClient();
  const payload = {
    course_id: parsed.data.courseId, title: parsed.data.title.trim(), description: parsed.data.description?.trim() || null, body: parsed.data.body?.trim() || null,
    resource_type: parsed.data.resourceType, external_url: parsed.data.externalUrl?.trim() || null, file_path: parsed.data.filePath?.trim() || null,
    position: parsed.data.position, duration_minutes: parsed.data.durationMinutes, required: formData.get("required") === "on", updated_at: new Date().toISOString(),
  };
  const operation = parsed.data.moduleId ? supabase.from("free_course_modules").update(payload).eq("id", parsed.data.moduleId) : supabase.from("free_course_modules").insert(payload);
  const { error } = await operation;
  if (error) redirect(`/admin/cursos?erro=${encodeURIComponent(error.message.includes("free_course_modules_course_id_position_key") ? "Já existe uma etapa nessa posição." : error.message)}`);
  revalidatePath("/admin/cursos"); revalidatePath("/aluno/modo-pensar");
  redirect(`/admin/cursos?sucesso=${encodeURIComponent(parsed.data.moduleId ? "Etapa atualizada." : "Etapa adicionada.")}`);
}

export async function removeFreeCourseModule(formData: FormData) {
  await requireRole("admin");
  const moduleId = z.string().uuid().safeParse(formData.get("moduleId"));
  if (!moduleId.success) return;
  const supabase = await createClient();
  const { count } = await supabase.from("free_course_module_progress").select("id", { count: "exact", head: true }).eq("module_id", moduleId.data);
  if ((count ?? 0) > 0) redirect(`/admin/cursos?erro=${encodeURIComponent("Esta etapa já possui progresso de aluno e não pode ser apagada. Edite o conteúdo ou arquive o curso.")}`);
  const { error } = await supabase.from("free_course_modules").delete().eq("id", moduleId.data);
  if (error) redirect(`/admin/cursos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/cursos");
  redirect(`/admin/cursos?sucesso=${encodeURIComponent("Etapa excluída.")}`);
}

export async function removeOrArchiveFreeCourse(formData: FormData) {
  await requireRole("admin");
  const courseId = z.string().uuid().safeParse(formData.get("courseId"));
  if (!courseId.success) return;
  const supabase = await createClient();
  const [{ data: course }, { count }] = await Promise.all([
    supabase.from("free_courses").select("status").eq("id", courseId.data).maybeSingle(),
    supabase.from("free_course_enrollments").select("id", { count: "exact", head: true }).eq("course_id", courseId.data),
  ]);
  if (!course) return;
  if (course.status !== "draft" || (count ?? 0) > 0) {
    await supabase.from("free_courses").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", courseId.data);
    revalidatePath("/admin/cursos"); revalidatePath("/aluno/modo-pensar");
    redirect(`/admin/cursos?sucesso=${encodeURIComponent("O curso já tinha histórico e foi arquivado.")}`);
  }
  await supabase.from("free_courses").delete().eq("id", courseId.data);
  revalidatePath("/admin/cursos");
  redirect(`/admin/cursos?sucesso=${encodeURIComponent("Rascunho de curso excluído.")}`);
}

const legalDraftSchema = z.object({
  documentId: z.string().uuid(), title: z.string().min(3).max(220), documentType: z.string().min(2).max(100), body: z.string().max(50000).optional(), filePath: z.string().max(1500).optional(),
});

export async function updateLegalDraft(formData: FormData) {
  await requireRole("admin");
  const parsed = legalDraftSchema.safeParse({ documentId: formData.get("documentId"), title: formData.get("title"), documentType: formData.get("documentType"), body: String(formData.get("body") || ""), filePath: String(formData.get("filePath") || "") });
  if (!parsed.success) redirect(`/admin/documentos?erro=${encodeURIComponent("Confira os dados do documento.")}`);
  const supabase = await createClient();
  const { data: doc } = await supabase.from("legal_documents").select("status").eq("id", parsed.data.documentId).maybeSingle();
  if (!doc || doc.status !== "draft") redirect(`/admin/documentos?erro=${encodeURIComponent("Documento publicado não é editado diretamente. Crie uma nova versão.")}`);
  const { error } = await supabase.from("legal_documents").update({ title: parsed.data.title.trim(), document_type: parsed.data.documentType.trim(), body: parsed.data.body?.trim() || null, file_path: parsed.data.filePath?.trim() || null, updated_at: new Date().toISOString() }).eq("id", parsed.data.documentId);
  if (error) redirect(`/admin/documentos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/documentos");
  redirect(`/admin/documentos?sucesso=${encodeURIComponent("Rascunho salvo.")}`);
}

export async function createLegalRevision(formData: FormData) {
  const viewer = await requireRole("admin");
  const documentId = z.string().uuid().safeParse(formData.get("documentId"));
  if (!documentId.success) return;
  const supabase = await createClient();
  const { data: current } = await supabase.from("legal_documents").select("title,public_slug,document_type,version,body,file_path").eq("id", documentId.data).maybeSingle();
  if (!current) return;
  const { data: maxVersion } = await supabase.from("legal_documents").select("version").eq("public_slug", current.public_slug).order("version", { ascending: false }).limit(1).maybeSingle();
  const nextVersion = Number(maxVersion?.version || current.version) + 1;
  const { error } = await supabase.from("legal_documents").insert({ title: current.title, public_slug: current.public_slug, document_type: current.document_type, version: nextVersion, status: "draft", is_current: false, body: current.body, file_path: current.file_path, created_by_user_id: viewer.user.id });
  if (error) redirect(`/admin/documentos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/documentos");
  redirect(`/admin/documentos?sucesso=${encodeURIComponent(`Versão ${nextVersion} criada como rascunho.`)}`);
}

export async function publishLegalDocument(formData: FormData) {
  await requireRole("admin");
  const documentId = z.string().uuid().safeParse(formData.get("documentId"));
  if (!documentId.success) return;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("legal_documents").select("public_slug,body,file_path").eq("id", documentId.data).maybeSingle();
  if (!doc) return;
  if (!doc.body && !doc.file_path) redirect(`/admin/documentos?erro=${encodeURIComponent("Adicione o texto ou o caminho do arquivo antes de publicar.")}`);
  await supabase.from("legal_documents").update({ is_current: false, updated_at: new Date().toISOString() }).eq("public_slug", doc.public_slug);
  const { error } = await supabase.from("legal_documents").update({ status: "published", is_current: true, published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", documentId.data);
  if (error) redirect(`/admin/documentos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/documentos"); revalidatePath("/");
  redirect(`/admin/documentos?sucesso=${encodeURIComponent("Documento publicado. Esta é a versão pública atual.")}`);
}

export async function archiveLegalDocument(formData: FormData) {
  await requireRole("admin");
  const documentId = z.string().uuid().safeParse(formData.get("documentId"));
  if (!documentId.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("legal_documents").update({ status: "archived", is_current: false, updated_at: new Date().toISOString() }).eq("id", documentId.data);
  if (error) redirect(`/admin/documentos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/documentos"); revalidatePath("/");
  redirect(`/admin/documentos?sucesso=${encodeURIComponent("Documento arquivado.")}`);
}

export async function setInstitutionalAccess(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = z.object({ profileId: z.string().uuid(), role: z.enum(["admin","teacher","guardian"]), enabled: z.enum(["true","false"]), returnTo: z.string() }).safeParse({ profileId: formData.get("profileId"), role: formData.get("role"), enabled: formData.get("enabled"), returnTo: String(formData.get("returnTo") || "/admin/usuarios") });
  if (!parsed.success) return;
  const safeReturn = parsed.data.returnTo.startsWith("/admin/") ? parsed.data.returnTo : "/admin/usuarios";
  if (parsed.data.profileId === viewer.user.id && parsed.data.role === "admin" && parsed.data.enabled === "false") {
    redirect(`${safeReturn}?erro=${encodeURIComponent("Você não pode remover seu próprio acesso de Admin por este botão.")}`);
  }
  const supabase = await createClient();
  if (parsed.data.role === "admin" && parsed.data.enabled === "false") {
    const { count } = await supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) redirect(`${safeReturn}?erro=${encodeURIComponent("O Curió precisa manter pelo menos um administrador ativo.")}`);
  }
  if (parsed.data.enabled === "true") {
    await supabase.from("user_roles").upsert({ user_id: parsed.data.profileId, role: parsed.data.role }, { onConflict: "user_id,role" });
    if (parsed.data.role === "teacher") await supabase.from("teachers").update({ active: true }).eq("profile_id", parsed.data.profileId);
    if (parsed.data.role === "guardian") await supabase.from("guardians").update({ active: true }).eq("profile_id", parsed.data.profileId);
  } else {
    await supabase.from("user_roles").delete().eq("user_id", parsed.data.profileId).eq("role", parsed.data.role);
    if (parsed.data.role === "teacher") await supabase.from("teachers").update({ active: false }).eq("profile_id", parsed.data.profileId);
    if (parsed.data.role === "guardian") await supabase.from("guardians").update({ active: false }).eq("profile_id", parsed.data.profileId);
  }
  revalidatePath("/admin/usuarios"); revalidatePath("/admin/professores"); revalidatePath("/admin/familias");
  redirect(`${safeReturn}?sucesso=${encodeURIComponent(parsed.data.enabled === "true" ? "Acesso reativado." : "Acesso retirado. O histórico foi preservado.")}`);
}

export async function updateTeacherAdmin(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({
    teacherId: z.string().uuid(), profileId: z.string().uuid(), fullName: z.string().min(2).max(140), preferredName: z.string().max(100).optional(),
    phone: z.string().max(40).optional(), professionalDescription: z.string().max(1000).optional(),
  }).safeParse({
    teacherId: formData.get("teacherId"), profileId: formData.get("profileId"), fullName: formData.get("fullName"),
    preferredName: String(formData.get("preferredName") || ""), phone: String(formData.get("phone") || ""), professionalDescription: String(formData.get("professionalDescription") || ""),
  });
  if (!parsed.success) redirect(`/admin/professores?erro=${encodeURIComponent("Confira os dados do professor.")}`);
  const supabase = await createClient();
  const [{ error: profileError }, { error: teacherError }] = await Promise.all([
    supabase.from("profiles").update({ full_name: parsed.data.fullName.trim(), preferred_name: parsed.data.preferredName?.trim() || null, phone_whatsapp: parsed.data.phone?.trim() || null, updated_at: new Date().toISOString() }).eq("id", parsed.data.profileId),
    supabase.from("teachers").update({ phone_whatsapp: parsed.data.phone?.trim() || null, professional_description: parsed.data.professionalDescription?.trim() || null }).eq("id", parsed.data.teacherId),
  ]);
  if (profileError || teacherError) redirect(`/admin/professores?erro=${encodeURIComponent("Não foi possível salvar as alterações.")}`);
  revalidatePath("/admin/professores"); revalidatePath("/professor/perfil");
  redirect(`/admin/professores?sucesso=${encodeURIComponent("Professor atualizado.")}`);
}
