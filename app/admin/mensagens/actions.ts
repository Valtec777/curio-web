"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  studentId: z.string().uuid(),
  guardianId: z.string().uuid(),
  subject: z.string().trim().min(2).max(160),
  body: z.string().trim().min(1).max(5000),
  actionLabel: z.string().trim().max(80).optional(),
  actionUrl: z.string().trim().max(500).optional(),
  requestKey: z.string().min(8).max(160),
}).refine((data) => Boolean(data.actionLabel) === Boolean(data.actionUrl), {
  message: "Preencha o texto e o destino do botão juntos.",
});

type Variables = Record<string, string | null>;

function one<T = any>(value: any): T | null {
  return (Array.isArray(value) ? value[0] : value) || null;
}

function renderVariables(value: string, variables: Variables) {
  const unresolved = new Set<string>();
  const rendered = value.replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}/gi, (_match, rawName: string) => {
    const key = rawName.toLowerCase();
    const resolved = Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : null;
    if (!resolved) {
      unresolved.add(rawName);
      return `{{${rawName}}}`;
    }
    return resolved;
  });
  return { rendered, unresolved: [...unresolved] };
}

export async function sendAdminFamilyMessage(formData: FormData) {
  await requireRole("admin");
  const parsed = schema.safeParse({
    studentId: formData.get("studentId"),
    guardianId: formData.get("guardianId"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    actionLabel: String(formData.get("actionLabel") || "").trim() || undefined,
    actionUrl: String(formData.get("actionUrl") || "").trim() || undefined,
    requestKey: formData.get("requestKey"),
  });
  if (!parsed.success) redirect("/admin/mensagens?erro=" + encodeURIComponent(parsed.error.issues[0]?.message || "Revise a mensagem."));

  const supabase = await createClient();
  const [{ data: relation, error: relationError }, { data: teacherLink }] = await Promise.all([
    supabase
      .from("guardian_students")
      .select("guardian_id,student_id,guardians(active,profiles(full_name,preferred_name)),students(full_name,preferred_name,deleted_at)")
      .eq("guardian_id", parsed.data.guardianId)
      .eq("student_id", parsed.data.studentId)
      .maybeSingle(),
    supabase
      .from("teacher_students")
      .select("teachers(active,profiles(full_name,preferred_name))")
      .eq("student_id", parsed.data.studentId)
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
  ]);

  const guardian: any = one(relation?.guardians);
  const guardianProfile: any = one(guardian?.profiles);
  const student: any = one(relation?.students);
  const teacher: any = one(teacherLink?.teachers);
  const teacherProfile: any = one(teacher?.profiles);

  if (relationError || !relation || !guardian?.active || !student || student.deleted_at) {
    redirect("/admin/mensagens?erro=" + encodeURIComponent("A família não está vinculada a este aluno ativo."));
  }

  const guardianName = guardianProfile?.preferred_name || guardianProfile?.full_name || null;
  const studentName = student.preferred_name || student.full_name || null;
  const teacherName = teacher?.active ? (teacherProfile?.preferred_name || teacherProfile?.full_name || null) : null;
  const variables: Variables = {
    responsavel_nome: guardianName,
    "responsavel.nome": guardianName,
    aluno_nome: studentName,
    "aluno.nome": studentName,
    professor_nome: teacherName,
    "professor.nome": teacherName,
  };

  const subject = renderVariables(parsed.data.subject, variables);
  const body = renderVariables(parsed.data.body, variables);
  const actionLabel = parsed.data.actionLabel ? renderVariables(parsed.data.actionLabel, variables) : null;
  const actionUrl = parsed.data.actionUrl ? renderVariables(parsed.data.actionUrl, variables) : null;
  const unresolved = [
    ...subject.unresolved,
    ...body.unresolved,
    ...(actionLabel?.unresolved ?? []),
    ...(actionUrl?.unresolved ?? []),
  ];
  if (unresolved.length) {
    redirect("/admin/mensagens?erro=" + encodeURIComponent(`A variável {{${unresolved[0]}}} não pôde ser preenchida. Revise o vínculo ou remova a variável antes de enviar.`));
  }
  if (actionUrl && !actionUrl.rendered.startsWith("/") && !actionUrl.rendered.startsWith("https://")) {
    redirect("/admin/mensagens?erro=" + encodeURIComponent("O destino do botão precisa ser uma rota do CURIÓ ou uma URL HTTPS."));
  }

  const { error } = await supabase.rpc("send_curio_family_message", {
    p_student_id: parsed.data.studentId,
    p_guardian_id: parsed.data.guardianId,
    p_subject: subject.rendered,
    p_body: body.rendered,
    p_action_label: actionLabel?.rendered || null,
    p_action_url: actionUrl?.rendered || null,
    p_request_key: parsed.data.requestKey,
  });
  if (error) {
    console.error("Falha ao enviar mensagem do Admin para a família", error.code);
    redirect("/admin/mensagens?erro=" + encodeURIComponent("Não foi possível enviar a mensagem para essa família. Nenhuma mensagem duplicada deve ser criada; tente novamente."));
  }

  revalidatePath("/admin/mensagens");
  revalidatePath("/familia/mensagens");
  redirect("/admin/mensagens?sucesso=" + encodeURIComponent("Mensagem enviada para a família."));
}
