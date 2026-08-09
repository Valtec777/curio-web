import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentStudent } from "@/lib/student";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { viewer, student, supabase } = await getCurrentStudent();
  const { data: game } = student
    ? await supabase.from("student_game_profiles").select("stars,level_name").eq("student_id", student.id).maybeSingle()
    : { data: null };

  const name = student?.preferred_name || student?.full_name || viewer.profile?.preferred_name || viewer.profile?.full_name;
  const gradeName = (student as any)?.grades?.name;
  const subtitle = `${game?.level_name || "Explorador Curió"}${gradeName ? ` · ${gradeName}` : ""}`;

  return (
    <div className="kid-dashboard">
      <AppShell
        role="student"
        roles={viewer.roles}
        name={name}
        subtitle={subtitle}
        metricLabel="Estrelas"
        metricValue={game?.stars ?? 0}
      >
        {children}
      </AppShell>
    </div>
  );
}
