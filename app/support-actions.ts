"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ticketSchema = z.object({
  subject: z.string().min(3).max(140),
  description: z.string().min(5).max(3000),
  category: z.enum(["platform","pedagogical","financial","account","other"]),
  priority: z.enum(["low","normal","high"]),
  returnPath: z.string().startsWith("/").default("/dashboard"),
});

export async function createSupportTicket(formData: FormData) {
  const viewer = await requireUser();
  const parsed = ticketSchema.safeParse({
    subject: formData.get("subject"),
    description: formData.get("description"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    returnPath: formData.get("returnPath") || "/dashboard",
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("support_tickets").insert({
    opened_by_user_id: viewer.user.id,
    subject: parsed.data.subject,
    description: parsed.data.description,
    category: parsed.data.category,
    priority: parsed.data.priority,
  });
  revalidatePath(parsed.data.returnPath);
}
