import Image from "next/image";
import Link from "next/link";
import { getCurrentStudent } from "@/lib/student";
import { getSeasonalExperience } from "@/lib/seasonal";
import { EmptyState, Badge } from "@/components/ui";

function shortDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Bahia" }).format(new Date(value));
}

export default async function StudentHome() {
  const { student, supabase } = await getCurrentStudent();
  if (!student) return <EmptyState title="Sua conta ainda não está ligada ao perfil de aluno" description="A administração precisa concluir esse vínculo antes de liberar o seu espaço." />;

  const now = new Date().toISOString();
  const seasonal = getSeasonalExperience(new Date(), student.grades?.name);
  const [
    { data: missions }, { data: states }, { data: game }, { data: assessments }, { data: achievements }, { data: tips },
  ] = await Promise.all([
    supabase.from("mission_students").select("id,due_at,status,progress_percent,missions(title,objective,estimated_minutes,subjects(name))").eq("student_id", student.id).in("status", ["assigned", "in_progress"]).order("assigned_at").limit(4),
    supabase.from("student_skill_states").select("domain_level,evidence_count,skills(name)").eq("student_id", student.id).order("updated_at", { ascending:false }).limit(3),
    supabase.from("student_game_profiles").select("stars,streak_days,level_name").eq("student_id", student.id).maybeSingle(),
    supabase.from("assessment_students").select("id,status,assessments(title,scheduled_for,subjects(name))").eq("student_id", student.id).limit(10),
    supabase.from("student_achievements").select("achievement_id,earned_at,achievements(name,description,icon)").eq("student_id", student.id).order("earned_at", { ascending:false }).limit(1),
    supabase.from("daily_tips").select("text").eq("active", true).or(`starts_at.is.null,starts_at.lte.${now.slice(0,10)}`).limit(1),
  ]);
  const nextAssessment = (assessments ?? []).map((a:any)=>a.assessments ? ({...a,...a.assessments}) : null).filter(Boolean).filter((a:any)=>!a.scheduled_for || new Date(a.scheduled_for) >= new Date()).sort((a:any,b:any)=>+(new Date(a.scheduled_for||"2999-01-01"))-(+new Date(b.scheduled_for||"2999-01-01")))[0];
  const recentAchievement:any = achievements?.[0];

  return (
    <>
      <section className="kid-hero kid-hero-rich">
        <div className="kid-hero-copy"><div className="eyebrow" style={{ color: "#dfffa8" }}>Meu dia no CURIÓ</div><h1>Oi, {student.preferred_name}! 👋</h1><p>Escolha um desafio, tente primeiro e use as pistas quando precisar.</p><div className="kid-mini-stats"><span>★ {game?.stars ?? 0} estrelas</span><span>🔥 {game?.streak_days ?? 0} dia(s)</span><span>🧭 {game?.level_name || "Explorador Curió"}</span></div></div>
        <Image src="/mascotes/curio_capivara_principal_acolhendo.png" alt="Capivara do Curió" width={210} height={240} priority />
      </section>

      {seasonal && (
        <section className={`panel seasonal-mission seasonal-${seasonal.slug}`} data-decor={seasonal.decorations[0]}>
          <div className="eyebrow">{seasonal.eyebrow} · desafio especial</div>
          <h2>{seasonal.title}</h2>
          <p>{seasonal.description}</p>
          <div className="mission-card">
            <strong>Missão especial para {seasonal.band === "1-3" ? "1º ao 3º ano" : seasonal.band === "4-5" ? "4º e 5º ano" : "6º ao 8º ano"}</strong>
            <p>{seasonal.missionText}</p>
          </div>
          <span className="seasonal-note">Conteúdo editorial Curió · opcional · não substitui nem publica uma missão em nome da professora</span>
        </section>
      )}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><div><h2>🎯 Missões de hoje</h2><p>Continue uma missão ou comece uma nova.</p></div><Link href="/aluno/missoes">Ver todas →</Link></div>
          {missions?.length ? <div className="form-stack">{missions.map((item:any)=><Link className="mission-card" href={`/aluno/missoes/${item.id}`} key={item.id}><div className="flex space-between gap-8 wrap"><div className="flex gap-8 wrap"><Badge tone="pink">{item.missions?.subjects?.name || "Missão Cuca"}</Badge><Badge tone="neutral">{item.missions?.estimated_minutes || 20} min</Badge></div><Badge tone={item.status === "in_progress" ? "yellow" : "blue"}>{item.status === "in_progress" ? "Em andamento" : "Não iniciada"}</Badge></div><h3>{item.missions?.title}</h3><p>{item.missions?.objective}</p>{item.status === "in_progress" && <div className="progress"><span style={{ width: `${item.progress_percent || 0}%` }} /></div>}<small className="muted">{item.due_at ? `Entrega ${shortDate(item.due_at)}` : "Sem prazo definido"}</small></Link>)}</div> : <EmptyState title="Tudo em dia!" description="Não há missão pendente neste momento." />}
        </section>

        <div className="form-stack">
          <section className="panel"><div className="panel-head"><div><h2>📅 Próxima avaliação</h2><p>Prepare-se sem deixar para a última hora.</p></div></div>{nextAssessment ? <div className="mission-card"><Badge tone="blue">{nextAssessment.subjects?.name || "Avaliação"}</Badge><h3>{nextAssessment.title}</h3><p>{nextAssessment.scheduled_for ? `Marcada para ${shortDate(nextAssessment.scheduled_for)}` : "Data será informada pela professora."}</p><Link href="/aluno/modo-prova">Abrir Modo Prova →</Link></div> : <p className="muted">Nenhuma avaliação próxima.</p>}</section>
          <section className="panel"><div className="panel-head"><div><h2>🏆 Conquista recente</h2></div></div>{recentAchievement ? <div className="achievement-inline"><span>{recentAchievement.achievements?.icon || "★"}</span><div><strong>{recentAchievement.achievements?.name}</strong><p>{recentAchievement.achievements?.description}</p></div></div> : <p className="muted">Sua primeira conquista está chegando.</p>}</section>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel"><div className="panel-head"><div><h2>🌱 Estou desenvolvendo</h2><p>Sem rótulos. Só próximos desafios.</p></div></div>{states?.length ? <div className="form-stack">{states.map((state:any,index)=><div className="preview-step" key={index}>{state.evidence_count < 2 ? "🔎" : state.domain_level >= 3 ? "✨" : "🌱"} {state.skills?.name}</div>)}</div> : <p className="muted">Seu mapa começa a aparecer depois das primeiras missões corrigidas.</p>}</section>
        <section className="panel tip-card"><Image src="/mascotes/curio_tamandua_avatar_neutro.png" alt="Tamanduá do Curió" width={105} height={120}/><div><div className="eyebrow">Dica do Curió</div><h2>Pare, procure a pista e explique.</h2><p>{tips?.[0]?.text || "Antes de responder, descubra o que a questão está pedindo e tente explicar com suas palavras."}</p><Link href="/aluno/modo-pensar">Abrir Modo Pensar →</Link></div></section>
      </div>
    </>
  );
}
