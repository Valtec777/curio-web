import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentTeacher } from "@/lib/teacher";
import "./teacher-workspace.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { viewer, teacher, supabase } = await getCurrentTeacher();
  const { count: activeStudents } = teacher
    ? await supabase
        .from("teacher_students")
        .select("student_id", { count: "exact", head: true })
        .eq("teacher_id", teacher.id)
        .eq("active", true)
    : { count: 0 };

  return (
    <AppShell
      role="teacher"
      roles={viewer.roles}
      name={viewer.profile?.preferred_name || viewer.profile?.full_name}
      subtitle="Seu espaço de acompanhamento"
      metricLabel="Alunos ativos"
      metricValue={activeStudents ?? 0}
    >
      {children}
    </AppShell>
  );
}
