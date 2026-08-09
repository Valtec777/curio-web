import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { FamilyPinGate } from "@/components/family-pin-gate";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("guardian");
  const supabase = await createClient();
  const { data: pinStatus } = await supabase.rpc("guardian_pin_status");
  const firstStatus = Array.isArray(pinStatus) ? pinStatus[0] : null;
  const needsPin = !firstStatus?.has_pin;

  return (
    <AppShell
      role="guardian"
      roles={viewer.roles}
      name={viewer.profile?.preferred_name || viewer.profile?.full_name}
      subtitle="Ninho da Família"
    >
      <FamilyPinGate required={needsPin}>{children}</FamilyPinGate>
    </AppShell>
  );
}
