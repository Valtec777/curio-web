import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { MonthlyInterestPrompt } from "@/components/monthly-interest-prompt";
import { getCurrentTeacher } from "@/lib/teacher";
import { shouldShowMonthlyInterest } from "@/lib/monthly-interest";
import "./teacher-workspace.css";
import "./teacher-fixes.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { viewer, teacher, supabase } = await getCurrentTeacher();
  const [{ count: activeStudents }, showInterest] = await Promise.all([
    teacher
      ? supabase
          .from("teacher_students")
          .select("student_id", { count: "exact", head: true })
          .eq("teacher_id", teacher.id)
          .eq("active", true)
      : Promise.resolve({ count: 0 } as any),
    shouldShowMonthlyInterest(supabase, viewer.user.id, "teacher"),
  ]);

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
      {showInterest ? <MonthlyInterestPrompt role="teacher" /> : null}
    </AppShell>
  );
}
