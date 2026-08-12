import { PageHeader } from "@/components/ui";
import { ReferralPanel } from "@/components/referral-panel";
import { requireRole } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export default async function FamilyReferralsPage() {
  const viewer = await requireRole("guardian");
  const supabase = await createClient();
  const [{ data: code }, { data: rule }] = await Promise.all([
    supabase.from("referral_codes").select("code,active").eq("owner_user_id", viewer.user.id).eq("owner_role", "guardian").maybeSingle(),
    supabase.from("referral_program_rules").select("reward_value,qualification_days,max_rewards_period,period_days,active").eq("owner_role", "guardian").maybeSingle(),
  ]);
  const siteUrl = await getSiteUrl();
  const referralUrl = code?.active ? `${siteUrl}/indicacao/${encodeURIComponent(code.code)}` : null;

  return (
    <>
      <PageHeader eyebrow="Ninho da Família" title="Indique o CURIÓ" description="Um programa simples, com recompensa limitada e validação antes de qualquer crédito." />
      <ReferralPanel role="guardian" code={code?.active ? code.code : null} url={referralUrl} rule={rule} />
    </>
  );
}
