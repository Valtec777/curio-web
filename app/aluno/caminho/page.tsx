import Image from "next/image";
import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { CurioIcon } from "@/components/nav-icon";
import { getCurrentStudent } from "@/lib/student";

function pct(value: number) { return `${Math.max(0, Math.min(100, Math.round(value)))}%`; }
function relation<T=any>(value: any): T | null { return (Array.isArray(value) ? value[0] : value) || null; }
function mondayOfCurrentWeek() { const d=new Date(); const day=(d.getDay()+6)%7; d.setHours(0,0,0,0); d.setDate(d.getDate()-day); return d; }

export default async function StudentPathPage() {
  const { student, supabase } = await getCurrentStudent();
  await supabase.rpc("refresh_student_achievements", { p_student_id: student.id });

  const [{ data: game }, { data: missions }, { data: notebooks }, { data: states }, { data: achievements }, { data: tips }, { data: characters }] = await Promise.all([
    supabase.from("student_game_profiles").select("stars,streak_days,level_name").eq("student_id", student.id).maybeSingle(),
    supabase.from("mission_students").select("status,assigned_at,completed_at,before_score,after_score,stars_awarded,missions(title,subject_id,subjects(name))").eq("student_id", student.id).limit(250),
    supabase.from("notebook_assignments").select("status,submitted_at,score,stars_awarded,notebook_activities(subject_id,title,subjects(name))").eq("student_id", student.id).limit(250),
    supabase.from("student_skill_states").select("domain_level,manual_domain_level,evidence_count,trend,priority,skills(name)").eq("student_id", student.id).order("updated_at", { ascending:false }).limit(120),
    supabase.from("student_achievements").select("earned_at,achievements(id,name,description,icon,color_key)").eq("student_id", student.id).order("earned_at", { ascending:false }).limit(6),
    supabase.from("daily_tips").select("id,text").eq("active", true).limit(100),
    supabase.from("characters").select("id,name,assets").eq("active", true).order("name"),
  ]);

  const allMission = missions ?? [];
  const allNotebook = notebooks ?? [];
  const completedMissions = allMission.filter((m:any)=>m.status === "reviewed");
  const completedNotebooks = allNotebook.filter((n:any)=>["submitted","reviewed"].includes(n.status));
  const totalAssigned = allMission.filter((m:any)=>m.status !== "cancelled").length + allNotebook.length;
  const totalDone = completedMissions.length + completedNotebooks.length;
  const overall = totalAssigned ? totalDone / totalAssigned * 100 : 0;

  const subjectData = new Map<string,{ scores:number[]; done:number; total:number }>();
  const touch = (name:string) => { const row=subjectData.get(name)||{scores:[],done:0,total:0}; subjectData.set(name,row); return row; };
  for (const m of allMission as any[]) { const mission:any=relation(m.missions); const subject:any=relation(mission?.subjects); const name=subject?.name||"Outros"; const row=touch(name); row.total++; if(m.status==="reviewed") row.done++; const score=Number(m.after_score); if(Number.isFinite(score)) row.scores.push(score); }
  for (const n of allNotebook as any[]) { const act:any=relation(n.notebook_activities); const subject:any=relation(act?.subjects); const name=subject?.name||"Outros"; const row=touch(name); row.total++; if(["submitted","reviewed"].includes(n.status)) row.done++; const score=Number(n.score); if(Number.isFinite(score)) row.scores.push(score); }
  const subjects=[...subjectData.entries()].map(([name,row])=>({name, progress:row.total?row.done/row.total*100:0, performance:row.scores.length?row.scores.reduce((a,b)=>a+b,0)/row.scores.length:null, done:row.done})).sort((a,b)=>b.progress-a.progress);

  const weekStart=mondayOfCurrentWeek();
  const dayPoints=[0,0,0,0,0,0,0];
  const addPoints=(dateValue:any,points:any)=>{ if(!dateValue)return; const d=new Date(dateValue); const diff=Math.floor((+new Date(d.getFullYear(),d.getMonth(),d.getDate())-+weekStart)/86400000); if(diff>=0&&diff<7) dayPoints[diff]+=Number(points||0); };
  for(const m of allMission as any[]) addPoints(m.completed_at,m.stars_awarded);
  for(const n of allNotebook as any[]) addPoints(n.submitted_at,n.stars_awarded);
  const maxDay=Math.max(1,...dayPoints);
  const weekNames=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

  const evidenced=(states??[]).filter((s:any)=>Number(s.evidence_count||0)>=2);
  const mastered=evidenced.filter((s:any)=>Number(s.manual_domain_level??s.domain_level)>=3);
  const reinforce=evidenced.filter((s:any)=>Number(s.manual_domain_level??s.domain_level)<3).sort((a:any,b:any)=>Number(b.priority||0)-Number(a.priority||0));

  const avatars=(characters??[]).map((c:any)=>({name:c.name,url:c.assets?.avatar||c.assets?.principal||null})).filter((c:any)=>c.url);
  const dayIndex=Math.floor((Date.now()/86400000));
  const tip=(tips??[]).length ? (tips??[])[dayIndex%(tips??[]).length]?.text : "Pequenos passos todos os dias levam a grandes descobertas.";
  const recentAchievements=(achievements??[]).map((a:any)=>({earned_at:a.earned_at, achievement:relation(a.achievements)})).filter((a:any)=>a.achievement);

  return <>
    <PageHeader eyebrow="Explorador Plumareli" title="Meu caminho" description="Sua jornada de descoberta: veja o que já avançou e o que vem por aí." />

    <section className="student-path-hero">
      <div><span className="student-kicker">Seu progresso geral</span><h2>{totalAssigned ? pct(overall) : "Começando"}</h2><p>{totalAssigned ? `Você já concluiu ${totalDone} de ${totalAssigned} desafios registrados.` : "Sua trilha vai ganhar forma conforme você fizer as primeiras atividades."}</p><div className="student-big-progress"><span style={{width:pct(overall)}} /></div></div>
      <div className="student-streak-orb"><span className="student-streak-icon"><CurioIcon name="fire" /></span><strong>{game?.streak_days??0}</strong><small>dias seguidos</small></div>
    </section>

    <section className="panel"><div className="panel-head"><div><h2>Evolução por matéria</h2><p>Cada matéria mostra o que foi concluído e, quando já existe nota, o aproveitamento observado.</p></div></div>{subjects.length ? <div className="student-subject-grid">{subjects.map((subject,index)=>{const avatar=avatars.length?avatars[index%avatars.length]:null;return <article className="student-subject-card" key={subject.name}>{avatar?<Image className="student-subject-character" src={avatar.url} alt="" width={72} height={72}/>:<div className="student-subject-icon"><CurioIcon name="book" /></div>}<div><h3>{subject.name}</h3><div className="student-progress-line"><span style={{width:pct(subject.progress)}} /></div><p>{pct(subject.progress)} da trilha · {subject.done} concluída(s)</p>{subject.performance!=null?<Badge tone="blue">Aproveitamento {pct(subject.performance)}</Badge>:<Badge tone="neutral">Aguardando resultados</Badge>}</div></article>})}</div>:<EmptyState title="A jornada ainda está começando" description="Quando você receber missões e atividades, as matérias aparecerão aqui." />}</section>

    <div className="grid-2">
      <section className="panel"><div className="panel-head"><div><h2>Sua semana de estudos</h2><p>Estrelas ganhas por dia nesta semana.</p></div></div><div className="student-week-chart" aria-label="Gráfico de estrelas por dia">{dayPoints.map((value,index)=><div className="student-week-column" key={weekNames[index]}><strong>{value}</strong><div className="student-week-bar"><span style={{height:`${Math.max(value?10:2,value/maxDay*100)}%`}} /></div><small>{weekNames[index]}</small></div>)}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>Desempenho por matéria</h2><p>Média somente quando já existe resultado corrigido.</p></div></div>{subjects.some(s=>s.performance!=null)?<div className="form-stack">{subjects.filter(s=>s.performance!=null).map(subject=><div key={subject.name}><div className="flex space-between gap-8"><strong>{subject.name}</strong><span>{pct(subject.performance!)}</span></div><div className="student-progress-line"><span style={{width:pct(subject.performance!)}} /></div></div>)}</div>:<p className="muted">Ainda não há notas suficientes para montar este gráfico.</p>}</section>
    </div>

    <div className="grid-2">
      <section className="panel student-mastered"><div className="panel-head"><div><h2 className="student-heading-with-icon"><span className="student-ui-icon"><CurioIcon name="check" /></span>Você já domina</h2><p>Temas com evidências suficientes de domínio.</p></div></div>{mastered.length?<div className="student-skill-cloud">{mastered.slice(0,12).map((s:any,i:number)=><Badge tone="green" key={`${s.skills?.name}-${i}`}>{s.skills?.name||"Habilidade"}</Badge>)}</div>:<p className="muted">Ainda estamos reunindo evidências. Continue explorando.</p>}</section>
      <section className="panel student-reinforce"><div className="panel-head"><div><h2 className="student-heading-with-icon"><span className="student-ui-icon"><CurioIcon name="refresh" /></span>Vamos praticar mais</h2><p>Temas que podem ganhar um pouco mais de treino.</p></div></div>{reinforce.length?<div className="student-skill-cloud">{reinforce.slice(0,12).map((s:any,i:number)=><Badge tone="yellow" key={`${s.skills?.name}-${i}`}>{s.skills?.name||"Habilidade"}</Badge>)}</div>:<p className="muted">Tudo em dia por aqui. Que tal explorar uma nova descoberta?</p>}</section>
    </div>

    <div className="grid-2">
      <section className="panel"><div className="panel-head"><div><h2>Conquistas recentes</h2><p>Selos desbloqueados na sua jornada.</p></div><Link href="/aluno/conquistas">Ver todas</Link></div>{recentAchievements.length?<div className="student-achievement-mini-list">{recentAchievements.map((row:any)=><article key={row.achievement.id}><span className="student-achievement-symbol"><CurioIcon name="trophy" /></span><div><strong>{row.achievement.name}</strong><p>{row.achievement.description}</p></div></article>)}</div>:<p className="muted">Sua primeira conquista está chegando.</p>}</section>
      <section className="panel student-tip-panel"><span className="student-tip-icon"><CurioIcon name="brain" /></span><div><span className="student-kicker">Dica do dia</span><h2>Um pequeno passo por vez</h2><p>{tip}</p></div></section>
    </div>
  </>;
}
