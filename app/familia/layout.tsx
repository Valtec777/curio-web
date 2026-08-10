import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { FamilyPinGate } from "@/components/family-pin-gate";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("guardian");
  const supabase = await createClient();
  const [{ data: pinStatus }, { data: childRows }] = await Promise.all([
    supabase.rpc("guardian_pin_status"),
    supabase.rpc("guardian_child_overview"),
  ]);
  const firstStatus = Array.isArray(pinStatus) ? pinStatus[0] : null;
  const needsPin = !firstStatus?.has_pin;
  const familyChildren = (Array.isArray(childRows) ? childRows : []).map((child: any) => ({
    id: child.student_id,
    name: child.student_name,
    grade: child.grade_name,
    teacher: child.teacher_name,
  }));

  return (
    <AppShell
      role="guardian"
      roles={viewer.roles}
      name={viewer.profile?.preferred_name || viewer.profile?.full_name}
      subtitle="Membro da Família"
      metricLabel="Crianças vinculadas"
      metricValue={familyChildren.length}
      familyChildren={familyChildren}
    >
      <FamilyPinGate required={needsPin}>{children}</FamilyPinGate>
    </AppShell>
  );
}
