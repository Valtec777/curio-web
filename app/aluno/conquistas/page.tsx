import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { CurioIcon, type CurioIconName } from "@/components/nav-icon";
import { StudentAchievementSound } from "@/components/student-achievement-sound";
import { getCurrentStudent } from "@/lib/student";

const achievementIcons = new Set<CurioIconName>(["heart","message","sparkles","pencil","search","shield","trophy","star","notebook","fire","refresh","check","map","book","calendar"]);
function iconName(value?: string | null): CurioIconName {
  return achievementIcons.has(value as CurioIconName) ? value as CurioIconName : "trophy";
}

export default async function StudentAchievementsPage() {
  const { viewer, student, supabase } = await getCurrentStudent();
  const { data: refreshedCount } = await supabase.rpc("refresh_student_achievements", { p_student_id: student.id });
  const newAchievementCount = Math.max(0, Number(refreshedCount || 0));

  const [{ data: catalog }, { data: earnedRows }] = await Promise.all([
    supabase.from("achievements").select("id,slug,name,description,icon,color_key,unlock_hint,sort_order").eq("active", true).order("sort_order").order("name"),
    supabase.from("student_achievements").select("achievement_id,earned_at").eq("student_id", student.id),
  ]);
  const earned = new Map((earnedRows ?? []).map((row:any)=>[row.achievement_id,row.earned_at]));
  const total = catalog?.length ?? 0;
  const unlocked = (catalog ?? []).filter((item:any)=>earned.has(item.id)).length;

  return <>
    <StudentAchievementSound viewerId={viewer.user.id} count={newAchievementCount} />
    <PageHeader eyebrow="Explorador Curió" title="Suas conquistas" description={`Você já desbloqueou ${unlocked} de ${total} selos. Continue explorando: cada selo marca um tipo diferente de avanço.`} />
    <section className="student-achievement-hero"><div><span className="student-achievement-hero-icon"><CurioIcon name="trophy" /></span><strong>{unlocked}</strong><small>conquistas desbloqueadas</small></div><div className="student-big-progress"><span style={{width:total?`${Math.round(unlocked/total*100)}%`:"0%"}} /></div><p>{total ? `${Math.round(unlocked/total*100)}% do catálogo já está no seu mural.` : "O catálogo está sendo preparado."}</p></section>
    {catalog?.length ? <div className="student-achievement-grid">{catalog.map((item:any)=>{const isEarned=earned.has(item.id);return <article className={`student-achievement-card${isEarned?" is-earned":" is-locked"}`} key={item.id}><div className="student-achievement-medal"><CurioIcon name={iconName(item.icon)} /></div><div><div className="flex gap-8 wrap"><Badge tone={isEarned?"green":"neutral"}>{isEarned?"Desbloqueada":"Ainda bloqueada"}</Badge></div><h3>{item.name}</h3><p>{item.description}</p><small>{isEarned ? "Conquista registrada na sua jornada." : item.unlock_hint || "Continue aprendendo para desbloquear."}</small></div></article>})}</div> : <EmptyState title="Catálogo em preparação" description="As conquistas Curió aparecerão aqui." />}
  </>;
}
