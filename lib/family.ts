import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FamilyChildOverview = {
  student_id: string;
  student_name: string;
  full_name: string;
  school_name: string | null;
  student_status: string;
  grade_name: string | null;
  relationship: string | null;
  can_view_progress: boolean;
  teacher_id: string | null;
  teacher_user_id: string | null;
  teacher_name: string | null;
  tracked_subjects: string[] | null;
};

export async function getFamilyPortal(requestedStudentId?: string | null) {
  const viewer = await requireRole("guardian");
  const supabase = await createClient();
  const { data: guardian } = await supabase
    .from("guardians")
    .select("id,active")
    .eq("profile_id", viewer.user.id)
    .maybeSingle();

  const { data } = guardian?.active ? await supabase.rpc("guardian_child_overview") : { data: [] };
  const children = (Array.isArray(data) ? data : []) as FamilyChildOverview[];
  const selectedChild = children.find((child) => child.student_id === requestedStudentId) || children[0] || null;

  return { viewer, supabase, guardian, children, selectedChild };
}
