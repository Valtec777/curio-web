import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CurioFirstVisitGuide } from "@/components/curio-first-visit-guide";
import { FamilyPinGate } from "@/components/family-pin-gate";
import { MonthlyInterestPrompt } from "@/components/monthly-interest-prompt";
import { requireRole } from "@/lib/auth";
import { shouldShowMonthlyInterest } from "@/lib/monthly-interest";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("guardian");
  const supabase = await createClient();
  const [{ data: pinStatus }, { data: childRows }, showInterest, { data: currentLegal }, { data: legalRecords }] = await Promise.all([
    supabase.rpc("guardian_pin_status"),
    supabase.rpc("guardian_child_overview"),
    shouldShowMonthlyInterest(supabase, viewer.user.id, "guardian"),
    supabase
      .from("legal_documents")
      .select("id,public_slug,version")
      .eq("status", "published")
      .eq("is_current", true)
      .in("public_slug", ["termos-de-uso", "politica-de-privacidade"]),
    supabase
      .from("legal_acceptance_events")
      .select("legal_document_id,document_slug,document_version,decision")
      .eq("user_id", viewer.user.id)
      .in("decision", ["accepted", "acknowledged"]),
  ]);
  const firstStatus = Array.isArray(pinStatus) ? pinStatus[0] : null;
  const needsPin = !firstStatus?.has_pin;
  const familyChildren = (Array.isArray(childRows) ? childRows : []).map((child: any) => ({
    id: child.student_id,
    name: child.student_name,
    grade: child.grade_name,
    teacher: child.teacher_name,
  }));
  const validRecordKeys = new Set((legalRecords ?? []).filter((event: any) => {
    if (event.document_slug === "politica-de-privacidade") return event.decision === "acknowledged";
    if (event.document_slug === "termos-de-uso") return event.decision === "accepted";
    return false;
  }).map((event: any) => `${event.legal_document_id}:${event.document_version}`));
  const pendingLegalCount = (currentLegal ?? []).filter((doc: any) => !validRecordKeys.has(`${doc.id}:${doc.version}`)).length;

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
      <FamilyPinGate required={needsPin}>
        {pendingLegalCount > 0 ? (
          <div className="notice mb-16">
            <strong>{pendingLegalCount === 1 ? "Há um documento jurídico atual para revisar." : `Há ${pendingLegalCount} documentos jurídicos atuais para revisar.`}</strong>{" "}
            <Link href="/familia/privacidade">Abrir Privacidade e autorizações</Link>.
          </div>
        ) : null}
        {children}
        <CurioFirstVisitGuide role="guardian" viewerId={viewer.user.id} supportHref="/familia/suporte" />
        {showInterest ? <MonthlyInterestPrompt role="guardian" /> : null}
      </FamilyPinGate>
    </AppShell>
  );
}
