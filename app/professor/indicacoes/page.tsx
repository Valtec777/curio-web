import { PageHeader } from "@/components/ui";
import { ReferralPanel } from "@/components/referral-panel";
import { requireRole } from "@/lib/auth";
import { getReferralDashboard } from "@/lib/referrals";
import { getSiteUrl } from "@/lib/site-url";

export default async function TeacherReferralsPage() {
  await requireRole("teacher");
  const dashboard = await getReferralDashboard("teacher");
  const siteUrl = await getSiteUrl();
  const referralUrl = dashboard.code ? `${siteUrl}/indicacao/${encodeURIComponent(dashboard.code)}` : null;

  return (
    <>
      <PageHeader
        eyebrow="Portal do Professor"
        title="Indicações"
        description="Compartilhe o CURIÓ com famílias que podem se beneficiar. O bônus só fica disponível após retenção e dentro do teto do período."
      />
      <ReferralPanel
        role="teacher"
        code={dashboard.code}
        url={referralUrl}
        rule={dashboard.rule}
        summary={dashboard.summary}
        activity={dashboard.activity}
      />
    </>
  );
}
