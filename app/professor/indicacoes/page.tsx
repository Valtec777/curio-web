import { PageHeader } from "@/components/ui";
import { ReferralPanel } from "@/components/referral-panel";
import { requireRole } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherReferralsPage() {
  const viewer = await requireRole("teacher");
  const supabase = await createClient();
  const [{ data: code }, { data: rule }] = await Promise.all([
    supabase.from("referral_codes").select("code,active").eq("owner_user_id", viewer.user.id).eq("owner_role", "teacher").maybeSingle(),
    supabase.from("referral_program_rules").select("reward_value,qualification_days,max_rewards_period,period_days,active").eq("owner_role", "teacher").maybeSingle(),
  ]);
  const siteUrl = await getSiteUrl();
  const referralUrl = code?.active ? `${siteUrl}/indicacao/${encodeURIComponent(code.code)}` : null;

  return (
    <>
      <PageHeader eyebrow="Portal do Professor" title="Indicações" description="Compartilhe o CURIÓ com famílias que podem aproveitar o acompanhamento, com regras de recompensa transparentes e limitadas." />
      <ReferralPanel role="teacher" code={code?.active ? code.code : null} url={referralUrl} rule={rule} />
    </>
  );
}
