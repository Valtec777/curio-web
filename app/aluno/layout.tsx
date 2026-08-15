import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CurioFirstVisitGuide } from "@/components/curio-first-visit-guide";
import { CurioPlayfulSoundEffects } from "@/components/curio-playful-sound-effects";
import { MonthlyInterestPrompt } from "@/components/monthly-interest-prompt";
import { getCurrentStudent } from "@/lib/student";
import { shouldShowMonthlyInterest } from "@/lib/monthly-interest";
import "./student-workspace.css";
import "./student-profile-extra.css";
import "./student-delight.css";
import "./student-extra-icons.css";
import "./student-interactions.css";
import "./student-celebrations.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { viewer, student, supabase } = await getCurrentStudent();
  const [{ data: game }, showInterest] = await Promise.all([
    student
      ? supabase.from("student_game_profiles").select("stars,level_name,avatar_character_id,characters(name,assets)").eq("student_id", student.id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    shouldShowMonthlyInterest(supabase, viewer.user.id, "student"),
  ]);

  const name = student?.preferred_name || student?.full_name || viewer.profile?.preferred_name || viewer.profile?.full_name;
  const gradeName = (student as any)?.grades?.name;
  const subtitle = `${game?.level_name || "Explorador Plumareli"}${gradeName ? ` · ${gradeName}` : ""}`;
  const character: any = Array.isArray((game as any)?.characters) ? (game as any).characters[0] : (game as any)?.characters;
  const avatarUrl = character?.assets?.avatar || character?.assets?.principal || null;

  return (
    <div className="kid-dashboard">
      <AppShell
        role="student"
        roles={viewer.roles}
        name={name}
        subtitle={subtitle}
        metricLabel="Estrelas"
        metricValue={game?.stars ?? 0}
        avatarUrl={avatarUrl}
      >
        {children}
        <CurioFirstVisitGuide role="student" viewerId={viewer.user.id} />
        <CurioPlayfulSoundEffects viewerId={viewer.user.id} />
        {showInterest ? <MonthlyInterestPrompt role="student" /> : null}
      </AppShell>
    </div>
  );
}
