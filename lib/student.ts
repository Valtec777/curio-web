import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentStudent() {
  const viewer = await requireUser();
  const supabase = await createClient();
  const cookieStore = await cookies();
  const studentContext = cookieStore.get("curio_student_context")?.value || null;

  let student: any = null;

  if (studentContext && viewer.roles.includes("guardian")) {
    const { data: guardian } = await supabase
      .from("guardians")
      .select("id")
      .eq("profile_id", viewer.user.id)
      .maybeSingle();

    if (guardian) {
      const { data: link } = await supabase
        .from("guardian_students")
        .select("student_id,students(id,preferred_name,full_name,grade_id,grades(name))")
        .eq("guardian_id", guardian.id)
        .eq("student_id", studentContext)
        .maybeSingle();
      student = (link as any)?.students || null;
    }
  }

  if (!student && viewer.roles.includes("student") && !viewer.roles.includes("guardian")) {
    const { data } = await supabase
      .from("students")
      .select("id,preferred_name,full_name,grade_id,grades(name)")
      .eq("auth_user_id", viewer.user.id)
      .maybeSingle();
    student = data;
  }

  if (!student && viewer.roles.includes("guardian")) redirect("/familia");
  if (!student) redirect("/dashboard");

  return { viewer, student, supabase, viaGuardian: Boolean(studentContext && viewer.roles.includes("guardian")) };
}
