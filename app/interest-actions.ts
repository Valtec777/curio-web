"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, type AppRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const roleSchema = z.enum(["teacher", "guardian", "student"]);

function monthStart() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit" }).format(new Date()) + "-01";
}

export async function saveMonthlyLearningInterest(formData: FormData) {
  const parsed = z.object({
    role: roleSchema,
    interest: z.string().trim().max(500).optional(),
    dismissed: z.string().optional(),
  }).safeParse({
    role: formData.get("role"),
    interest: String(formData.get("interest") || ""),
    dismissed: String(formData.get("dismissed") || ""),
  });
  if (!parsed.success) return;

  const role = parsed.data.role as AppRole;
  const viewer = await requireRole(role);
  const supabase = await createClient();
  const dismissed = parsed.data.dismissed === "true";

  await supabase.from("learning_interest_responses").upsert({
    user_id: viewer.user.id,
    role,
    response_month: monthStart(),
    interest_text: dismissed ? null : parsed.data.interest || null,
    dismissed,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,role,response_month" });

  revalidatePath(role === "teacher" ? "/professor" : role === "guardian" ? "/familia" : "/aluno");
}
