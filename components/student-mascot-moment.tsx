import { createClient } from "@/lib/supabase/server";
import { StudentMascotMomentClient } from "@/components/student-mascot-moment-client";

type StudentMascotMomentProps = {
  name: string;
  stars: number;
  streakDays: number;
  pendingMissions: number;
};

const mascotOrder = [
  {
    slug: "mico-leao-dourado",
    fallback: "/mascotes/plumareli_mico_leao_dourado_principal.webp",
  },
  {
    slug: "irara",
    fallback: "/mascotes/plumareli_irara_principal.webp",
  },
  {
    slug: "harpia",
    fallback: "/mascotes/plumareli_harpia_principal.webp",
  },
] as const;

export async function StudentMascotMoment(props: StudentMascotMomentProps) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("characters")
    .select("slug,assets")
    .in("slug", mascotOrder.map((item) => item.slug))
    .eq("active", true);

  const bySlug = new Map((data ?? []).map((item: any) => [item.slug, item.assets || {}]));
  const mascotImages = mascotOrder.map((item) => {
    const assets: any = bySlug.get(item.slug) || {};
    return assets.principal || assets.avatar || item.fallback;
  });

  return <StudentMascotMomentClient {...props} mascotImages={mascotImages} />;
}
