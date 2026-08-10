"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

function refreshProfile() {
  revalidatePath("/professor/perfil");
  revalidatePath("/professor");
}

export async function updateTeacherProfile(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/perfil");

  const parsed = z.object({
    fullName: z.string().trim().min(2).max(180),
    preferredName: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(40).optional(),
    professionalDescription: z.string().trim().max(1800).optional(),
  }).safeParse({
    fullName: formData.get("fullName"),
    preferredName: String(formData.get("preferredName") || ""),
    phone: String(formData.get("phone") || ""),
    professionalDescription: String(formData.get("professionalDescription") || ""),
  });
  if (!parsed.success) redirect(`/professor/perfil?erro=${encodeURIComponent("Revise seus dados de perfil.")}`);

  const { error } = await supabase.rpc("update_teacher_self_profile", {
    p_full_name: parsed.data.fullName,
    p_preferred_name: parsed.data.preferredName || "",
    p_phone: parsed.data.phone || "",
    p_professional_description: parsed.data.professionalDescription || "",
  });
  if (error) redirect(`/professor/perfil?erro=${encodeURIComponent("Não foi possível salvar seu perfil.")}`);

  const subjectIds = [...new Set(formData.getAll("subjectIds").map(String).filter((id) => z.string().uuid().safeParse(id).success))];
  const specialtyIds = [...new Set(formData.getAll("specialtyIds").map(String).filter((id) => z.string().uuid().safeParse(id).success))];

  const [{ data: validSubjects }, { data: validSpecialties }] = await Promise.all([
    subjectIds.length ? supabase.from("subjects").select("id").in("id", subjectIds).eq("active", true) : Promise.resolve({ data: [] as any[] }),
    specialtyIds.length ? supabase.from("teacher_specialty_catalog").select("id").in("id", specialtyIds).eq("active", true) : Promise.resolve({ data: [] as any[] }),
  ]);
  const safeSubjects = (validSubjects ?? []).map((item: any) => item.id);
  const safeSpecialties = (validSpecialties ?? []).map((item: any) => item.id);

  await supabase.from("teacher_subjects").delete().eq("teacher_id", teacher.id);
  if (safeSubjects.length) {
    const { error: subjectError } = await supabase.from("teacher_subjects").insert(safeSubjects.map((subjectId: string) => ({ teacher_id: teacher.id, subject_id: subjectId })));
    if (subjectError) redirect(`/professor/perfil?erro=${encodeURIComponent("Os dados foram salvos, mas revise as matérias selecionadas.")}`);
  }

  await supabase.from("teacher_specialties").delete().eq("teacher_id", teacher.id);
  if (safeSpecialties.length) {
    const { error: specialtyError } = await supabase.from("teacher_specialties").insert(safeSpecialties.map((specialtyId: string) => ({ teacher_id: teacher.id, specialty_id: specialtyId })));
    if (specialtyError) redirect(`/professor/perfil?erro=${encodeURIComponent("Os dados foram salvos, mas revise as especialidades selecionadas.")}`);
  }

  refreshProfile();
  redirect(`/professor/perfil?sucesso=${encodeURIComponent("Perfil atualizado.")}`);
}

export async function uploadTeacherAvatar(formData: FormData) {
  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/perfil");
  const value = formData.get("avatar");
  const file = value instanceof File && value.size > 0 ? value : null;
  if (!file) redirect(`/professor/perfil?erro=${encodeURIComponent("Escolha uma imagem.")}`);
  if (file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    redirect(`/professor/perfil?erro=${encodeURIComponent("Use PNG, JPG ou WEBP de até 5 MB.")}`);
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${viewer.user.id}/foto-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) redirect(`/professor/perfil?erro=${encodeURIComponent("Não foi possível enviar a foto.")}`);

  const { data: oldProfile } = await supabase.from("profiles").select("avatar_path").eq("id", viewer.user.id).maybeSingle();
  const { error: profileError } = await supabase.from("profiles").update({ avatar_path: path, updated_at: new Date().toISOString() }).eq("id", viewer.user.id);
  if (profileError) {
    await supabase.storage.from("profile-avatars").remove([path]);
    redirect(`/professor/perfil?erro=${encodeURIComponent("A foto foi enviada, mas não pôde ser vinculada ao perfil.")}`);
  }
  if (oldProfile?.avatar_path?.startsWith(`${viewer.user.id}/`)) {
    await supabase.storage.from("profile-avatars").remove([oldProfile.avatar_path]);
  }

  refreshProfile();
  redirect(`/professor/perfil?sucesso=${encodeURIComponent("Foto de perfil atualizada.")}`);
}

type Slot = { day: number; start: string; end: string };

function normalizeSlots(value: unknown): Slot[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item: any) =>
    item && Number.isInteger(item.day) && item.day >= 0 && item.day <= 6 && /^\d{2}:\d{2}$/.test(String(item.start)) && /^\d{2}:\d{2}$/.test(String(item.end)),
  ).map((item: any) => ({ day: Number(item.day), start: String(item.start), end: String(item.end) }));
}

export async function addTeacherAvailabilitySlot(formData: FormData) {
  const parsed = z.object({ day: z.coerce.number().int().min(0).max(6), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) }).safeParse({
    day: formData.get("day"), start: formData.get("start"), end: formData.get("end"),
  });
  if (!parsed.success || parsed.data.end <= parsed.data.start) redirect(`/professor/perfil?erro=${encodeURIComponent("Confira o dia e o horário de disponibilidade.")}`);
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/perfil");

  const { data: current } = await supabase.from("teacher_availability").select("weekly_slots,available_periods,notes").eq("teacher_id", teacher.id).maybeSingle();
  const slots = normalizeSlots(current?.weekly_slots);
  if (!slots.some((slot) => slot.day === parsed.data.day && slot.start === parsed.data.start && slot.end === parsed.data.end)) {
    slots.push(parsed.data);
  }
  slots.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

  const { error } = await supabase.from("teacher_availability").upsert({
    teacher_id: teacher.id,
    available_periods: current?.available_periods || [],
    notes: current?.notes || null,
    weekly_slots: slots,
    updated_at: new Date().toISOString(),
  }, { onConflict: "teacher_id" });
  if (error) redirect(`/professor/perfil?erro=${encodeURIComponent("Não foi possível salvar este horário.")}`);
  refreshProfile();
  redirect(`/professor/perfil?sucesso=${encodeURIComponent("Disponibilidade adicionada.")}`);
}

export async function removeTeacherAvailabilitySlot(formData: FormData) {
  const parsed = z.object({ day: z.coerce.number().int().min(0).max(6), start: z.string(), end: z.string() }).safeParse({ day: formData.get("day"), start: formData.get("start"), end: formData.get("end") });
  if (!parsed.success) return;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/perfil");
  const { data: current } = await supabase.from("teacher_availability").select("weekly_slots").eq("teacher_id", teacher.id).maybeSingle();
  const slots = normalizeSlots(current?.weekly_slots).filter((slot) => !(slot.day === parsed.data.day && slot.start === parsed.data.start && slot.end === parsed.data.end));
  const { error } = await supabase.from("teacher_availability").update({ weekly_slots: slots, updated_at: new Date().toISOString() }).eq("teacher_id", teacher.id);
  if (error) redirect(`/professor/perfil?erro=${encodeURIComponent("Não foi possível remover este horário.")}`);
  refreshProfile();
  redirect(`/professor/perfil?sucesso=${encodeURIComponent("Horário removido.")}`);
}
