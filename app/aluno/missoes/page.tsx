import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { StudentMissionCelebration } from "@/components/student-mission-celebration";
import { getCurrentStudent } from "@/lib/student";

function relation<T=any>(value:any):T|null{return (Array.isArray(value)?value[0]:value)||null;}
function shortDate(value?: string | null) { if (!value) return "Sem prazo"; return new Intl.DateTimeFormat("pt-BR", { day:"2-digit",month:"2-digit",year:"numeric",timeZone:"America/Bahia" }).format(new Date(value)); }
function statusLabel(status:string,late:boolean){if(late)return"Atrasada";if(status==="assigned")return"Não iniciada";if(status==="in_progress")return"Em andamento";if(status==="submitted")return"Enviada";if(status==="reviewed")return"Concluída";if(status==="cancelled")return"Cancelada";return status;}
function tone(status:string,late:boolean):"blue"|"pink"|"green"|"yellow"|"neutral"{if(late)return"pink";if(status==="reviewed")return"green";if(status==="submitted"||status==="in_progress")return"yellow";if(status==="cancelled")return"neutral";return"blue";}
function startOfWeek(){const d=new Date();const day=(d.getDay()+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d;}

export default async function StudentMissionsPage({ searchParams }: { searchParams: Promise<{ q?:string; materia?:string; status?:string; periodo?:string; erro?: string; sucesso?: string }> }) {
  const query=await searchParams;
  const { student, supabase }=await getCurrentStudent();
  const { data: assignments }=await supabase.from("mission_students").select("id,status,due_at,assigned_at,completed_at,progress_percent,stars_awarded,missions(title,objective,estimated_minutes,subjects(name))").eq("student_id",student.id).order("assigned_at",{ascending:false}).limit(200);

  const normalized=(assignments??[]).map((item:any)=>{const mission:any=relation(item.missions);const subject:any=relation(mission?.subjects);const late=["assigned","in_progress"].includes(item.status)&&item.due_at&&new Date(item.due_at)<new Date();return{...item,mission,subjectName:subject?.name||"Sem matéria",late};});
  const subjects=[...new Set(normalized.map((item:any)=>item.subjectName))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const q=String(query.q||"").trim().toLocaleLowerCase("pt-BR");
  const today=new Date();today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);const week=startOfWeek();const nextWeek=new Date(week);nextWeek.setDate(nextWeek.getDate()+7);
  const filtered=normalized.filter((item:any)=>{
    if(q&&!`${item.mission?.title||""} ${item.mission?.objective||""}`.toLocaleLowerCase("pt-BR").includes(q))return false;
    if(query.materia&&query.materia!=="todas"&&item.subjectName!==query.materia)return false;
    if(query.status&&query.status!=="todos"){
      if(query.status==="late"&&!item.late)return false;
      if(query.status==="completed"&&item.status!=="reviewed")return false;
      if(!["late","completed"].includes(query.status)&&item.status!==query.status)return false;
    }
    if(query.periodo==="hoje"){const d=new Date(item.due_at||item.assigned_at);if(!(d>=today&&d<tomorrow))return false;}
    if(query.periodo==="semana"){const d=new Date(item.due_at||item.assigned_at);if(!(d>=week&&d<nextWeek))return false;}
    if(query.periodo==="concluidas"&&item.status!=="reviewed")return false;
    if(query.periodo==="pendentes"&&!["assigned","in_progress","submitted"].includes(item.status))return false;
    return true;
  });
  const open=normalized.filter((i:any)=>["assigned","in_progress"].includes(i.status)).length;
  const completed=normalized.filter((i:any)=>i.status==="reviewed").length;
  const late=normalized.filter((i:any)=>i.late).length;

  const periodHref=(periodo:string)=>`/aluno/missoes?periodo=${periodo}${query.materia?`&materia=${encodeURIComponent(query.materia)}`:""}`;

  return <>
    <PageHeader eyebrow="Explorador Plumareli" title="Minhas missões" description="Cada missão é uma jornada: descubra, entenda, pratique e mostre o que aprendeu." />
    {query.erro&&<div className="form-message form-error">{query.erro}</div>}
    {query.sucesso&&<StudentMissionCelebration message={query.sucesso} />}
    <div className="student-metric-row"><div><strong>{open}</strong><span>Para fazer</span></div><div><strong>{completed}</strong><span>Concluídas</span></div><div><strong>{late}</strong><span>Atrasadas</span></div></div>
    <div className="student-filter-tabs"><Link href="/aluno/missoes">Todas</Link><Link href={periodHref("hoje")}>Hoje</Link><Link href={periodHref("semana")}>Esta semana</Link><Link href={periodHref("pendentes")}>Pendentes</Link><Link href={periodHref("concluidas")}>Concluídas</Link></div>
    <section className="panel student-filter-panel"><form method="get" className="student-mission-filters"><div className="field"><label>Buscar missão</label><input className="input" name="q" defaultValue={query.q||""} placeholder="Digite o nome da missão" /></div><div className="field"><label>Matéria</label><select className="select" name="materia" defaultValue={query.materia||"todas"}><option value="todas">Todas as matérias</option>{subjects.map(subject=><option key={subject} value={subject}>{subject}</option>)}</select></div><div className="field"><label>Status</label><select className="select" name="status" defaultValue={query.status||"todos"}><option value="todos">Todos os status</option><option value="assigned">Não iniciada</option><option value="in_progress">Em andamento</option><option value="submitted">Enviada</option><option value="completed">Concluída</option><option value="late">Atrasada</option></select></div>{query.periodo?<input type="hidden" name="periodo" value={query.periodo}/>:null}<button className="button button-primary" type="submit">Filtrar</button></form></section>
    <section className="panel mission-library-panel"><div className="panel-head"><div><h2>Missões Cuca</h2><p>{filtered.length} missão(ões) neste filtro. Atividades para fazer à mão ficam no Meu Caderno.</p></div><Link className="button button-secondary button-small" href="/aluno/caderno">Abrir Meu Caderno</Link></div>{filtered.length?<div className="mission-list-grid">{filtered.map((item:any)=>{const canOpen=["assigned","in_progress"].includes(item.status);const content=<><div className="flex space-between gap-8 wrap"><div className="flex gap-8 wrap"><Badge tone="pink">{item.subjectName}</Badge><Badge tone="neutral">{item.mission?.estimated_minutes||20} min</Badge></div><Badge tone={tone(item.status,item.late)}>{statusLabel(item.status,item.late)}</Badge></div><h3>{item.mission?.title||"Missão"}</h3><p>{item.mission?.objective||"Desafio Plumareli"}</p>{item.status==="in_progress"?<div className="progress"><span style={{width:`${item.progress_percent||0}%`}} /></div>:null}<div className="mission-card-foot"><small className="muted">Prazo: {shortDate(item.due_at)}</small>{item.stars_awarded>0?<Badge tone="yellow">+{item.stars_awarded} ★</Badge>:null}</div></>;return canOpen?<Link className="mission-card mission-card-clickable" href={`/aluno/missoes/${item.id}`} key={item.id}>{content}</Link>:<article className="mission-card" key={item.id}>{content}</article>;})}</div>:<EmptyState title="Nenhuma missão neste filtro" description="Tente mudar a matéria, o status ou o período." />}</section>
  </>;
}
