import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export async function getCurrentTeacher() {
  const viewer = await requireRole("teacher");
  const supabase = await createClient();

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, profile_id")
    .eq("profile_id", viewer.user.id)
    .eq("active", true)
    .maybeSingle();

  return { viewer, teacher, supabase };
}
