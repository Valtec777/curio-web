"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const allowedPeriods = ["Manhã", "Tarde", "Noite"] as const;

export async function updateTeacherTeachingProfile(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({
    teacherId: z.string().uuid(),
    notes: z.string().max(800).optional(),
  }).safeParse({
    teacherId: formData.get("teacherId"),
    notes: String(formData.get("availabilityNotes") || ""),
  });
  if (!parsed.success) {
    redirect(`/admin/professores?erro=${encodeURIComponent("Revise as informações de especialidade e disponibilidade.")}`);
  }

  const subjectIds = [...new Set(formData.getAll("subjectIds").map(String).filter((value) => z.string().uuid().safeParse(value).success))];
  const periods = [...new Set(formData.getAll("availablePeriods").map(String).filter((value): value is typeof allowedPeriods[number] => allowedPeriods.includes(value as typeof allowedPeriods[number])))];
  const supabase = await createClient();

  const { data: currentLinks, error: currentError } = await supabase
    .from("teacher_subjects")
    .select("subject_id")
    .eq("teacher_id", parsed.data.teacherId);
  if (currentError) {
    redirect(`/admin/professores?erro=${encodeURIComponent("Não foi possível carregar as matérias atuais do professor.")}`);
  }

  if (subjectIds.length) {
    const { error: upsertError } = await supabase.from("teacher_subjects").upsert(
      subjectIds.map((subjectId) => ({ teacher_id: parsed.data.teacherId, subject_id: subjectId })),
      { onConflict: "teacher_id,subject_id" },
    );
    if (upsertError) {
      redirect(`/admin/professores?erro=${encodeURIComponent("Não foi possível salvar as matérias do professor.")}`);
    }
  }

  const removeIds = (currentLinks ?? []).map((item: any) => item.subject_id).filter((id: string) => !subjectIds.includes(id));
  if (removeIds.length) {
    const { error: removeError } = await supabase
      .from("teacher_subjects")
      .delete()
      .eq("teacher_id", parsed.data.teacherId)
      .in("subject_id", removeIds);
    if (removeError) {
      redirect(`/admin/professores?erro=${encodeURIComponent("As novas matérias foram salvas, mas não foi possível remover uma matéria antiga. Revise o cadastro.")}`);
    }
  }

  const { error: availabilityError } = await supabase.from("teacher_availability").upsert({
    teacher_id: parsed.data.teacherId,
    available_periods: periods,
    notes: parsed.data.notes?.trim() || null,
  }, { onConflict: "teacher_id" });
  if (availabilityError) {
    redirect(`/admin/professores?erro=${encodeURIComponent("As matérias foram salvas, mas não foi possível atualizar a disponibilidade.")}`);
  }

  revalidatePath("/admin/professores");
  revalidatePath("/admin/matriculas");
  redirect(`/admin/professores?sucesso=${encodeURIComponent("Matérias e disponibilidade atualizadas.")}`);
}

export async function moveTeacherToTrash(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = z.object({
    teacherId: z.string().uuid(),
    reason: z.string().max(300).optional(),
  }).safeParse({
    teacherId: formData.get("teacherId"),
    reason: String(formData.get("reason") || ""),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id,profile_id,active,phone_whatsapp,professional_description,profiles(full_name,preferred_name)")
    .eq("id", parsed.data.teacherId)
    .maybeSingle();

  if (!teacher) {
    redirect(`/admin/professores?erro=${encodeURIComponent("Professor não encontrado.")}`);
  }

  const { data: alreadyTrashed } = await supabase
    .from("trash_items")
    .select("id")
    .eq("entity_type", "teachers")
    .eq("entity_id", teacher.id)
    .is("restored_at", null)
    .maybeSingle();
  if (alreadyTrashed) {
    redirect(`/admin/professores?erro=${encodeURIComponent("Este professor já está na Lixeira.")}`);
  }

  const [{ count: studentLinks }, { count: classLinks }, { data: roleRow }] = await Promise.all([
    supabase.from("teacher_students").select("student_id", { count: "exact", head: true }).eq("teacher_id", teacher.id),
    supabase.from("class_teachers").select("class_id", { count: "exact", head: true }).eq("teacher_id", teacher.id),
    supabase.from("user_roles").select("user_id").eq("user_id", teacher.profile_id).eq("role", "teacher").maybeSingle(),
  ]);

  const profile = teacher.profiles as any;
  const now = new Date();
  const reason = parsed.data.reason?.trim() || "Removido pelo Admin";
  const { error: trashError } = await supabase.from("trash_items").insert({
    entity_type: "teachers",
    entity_id: teacher.id,
    entity_snapshot: {
      label: profile?.preferred_name || profile?.full_name || "Professor",
      profile_id: teacher.profile_id,
      previous_active: teacher.active,
      had_teacher_role: Boolean(roleRow),
      reason,
      dependencies: {
        teacher_students: studentLinks ?? 0,
        class_teachers: classLinks ?? 0,
      },
    },
    deleted_by_user_id: viewer.user.id,
    deleted_at: now.toISOString(),
    restore_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (trashError && trashError.code !== "23505") {
    redirect(`/admin/professores?erro=${encodeURIComponent("Não foi possível enviar o professor para a Lixeira.")}`);
  }

  const { error: deactivateError } = await supabase
    .from("teachers")
    .update({ active: false })
    .eq("id", teacher.id);
  if (deactivateError) {
    redirect(`/admin/professores?erro=${encodeURIComponent("A Lixeira foi registrada, mas não foi possível desativar o professor. Revise o registro antes de repetir a ação.")}`);
  }

  const { error: roleError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", teacher.profile_id)
    .eq("role", "teacher");
  if (roleError) {
    redirect(`/admin/professores?erro=${encodeURIComponent("O professor saiu da operação, mas o papel de acesso não pôde ser removido. Revise o usuário antes de restaurar.")}`);
  }

  revalidatePath("/admin/professores");
  revalidatePath("/admin/lixeira");
  revalidatePath("/admin/alunos");
  revalidatePath("/professor");
  redirect(`/admin/professores?sucesso=${encodeURIComponent("Professor enviado para a Lixeira. Alunos, turmas, missões e correções foram preservados.")}`);
}
