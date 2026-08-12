"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ticketSchema = z.object({
  subject: z.string().trim().min(3, "Informe o assunto do chamado.").max(140),
  description: z.string().trim().min(5, "Explique um pouco melhor o que aconteceu.").max(3000),
  category: z.enum(["platform","pedagogical","financial","account","other"]),
  priority: z.enum(["low","normal","high"]),
  returnPath: z.string().default("/dashboard"),
});

function safeReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (["/admin", "/professor", "/familia", "/aluno", "/dashboard"].some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) return value;
  return "/dashboard";
}

function withMessage(path: string, key: "erro" | "sucesso", message: string) {
  const url = new URL(path, "https://curio.local");
  url.searchParams.delete("erro");
  url.searchParams.delete("sucesso");
  url.searchParams.set(key, message);
  return `${url.pathname}${url.search}`;
}

export async function createSupportTicket(formData: FormData) {
  const viewer = await requireUser();
  const parsed = ticketSchema.safeParse({
    subject: formData.get("subject"),
    description: formData.get("description"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    returnPath: String(formData.get("returnPath") || "/dashboard"),
  });
  const returnPath = safeReturnPath(String(formData.get("returnPath") || "/dashboard"));
  if (!parsed.success) {
    redirect(withMessage(returnPath, "erro", parsed.error.issues[0]?.message || "Revise o chamado."));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("support_tickets").insert({
    opened_by_user_id: viewer.user.id,
    subject: parsed.data.subject,
    description: parsed.data.description,
    category: parsed.data.category,
    priority: parsed.data.priority,
  });
  if (error) {
    console.error("Falha ao criar chamado de suporte", error.code);
    redirect(withMessage(returnPath, "erro", "Não foi possível enviar a solicitação agora. Tente novamente."));
  }

  revalidatePath(returnPath);
  redirect(withMessage(returnPath, "sucesso", "Solicitação enviada para o suporte CURIÓ."));
}
