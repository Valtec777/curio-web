import { PageHeader } from "@/components/ui";
import { ReferralPanel } from "@/components/referral-panel";
import { requireRole } from "@/lib/auth";
import { getReferralDashboard } from "@/lib/referrals";
import { getSiteUrl } from "@/lib/site-url";

export default async function FamilyReferralsPage() {
  await requireRole("guardian");
  const dashboard = await getReferralDashboard("guardian");
  const siteUrl = await getSiteUrl();
  const referralUrl = dashboard.code ? `${siteUrl}/indicacao/${encodeURIComponent(dashboard.code)}` : null;

  return (
    <>
      <PageHeader
        eyebrow="Ninho da Família"
        title="Indique o CURIÓ"
        description="Compartilhe seu link individual. A recompensa é limitada e só fica disponível depois da permanência mínima da nova família."
      />
      <ReferralPanel
        role="guardian"
        code={dashboard.code}
        url={referralUrl}
        rule={dashboard.rule}
        summary={dashboard.summary}
        activity={dashboard.activity}
      />
    </>
  );
}
