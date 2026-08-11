import Image from "next/image";
import Link from "next/link";
import { getCurrentStudent } from "@/lib/student";
import { EmptyState, Badge } from "@/components/ui";
import { NavIcon } from "@/components/nav-icon";

function relation<T=any>(value:any):T|null{return (Array.isArray(value)?value[0]:value)||null;}
function dt(value?:string|null){if(!value)return"—";return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Bahia"}).format(new Date(value));}
function startOfWeek(){const d=new Date();const day=(d.getDay()+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d;}
function UiIcon({label}:{label:string}){return <span className="student-ui-icon" aria-hidden="true"><NavIcon label={label}/></span>;}

export default async function StudentHome() {
  const { student, supabase } = await getCurrentStudent();
  if (!student) return <EmptyState title="Seu espaço ainda está sendo preparado" description="A administração precisa concluir o vínculo antes de liberar o seu portal." />;
  await supabase.rpc("refresh_student_achievements",{p_student_id:student.id});

  const now=new Date();
  const [{data:missionRows},{data:notebooks},{data:game},{data:assessments},{data:achievementRows},{data:tips},{data:agendaLinks},{count:achievementCount}] = await Promise.all([
    supabase.from("mission_students").select("id,due_at,status,progress_percent,assigned_at,completed_at,stars_awarded,missions(title,objective,estimated_minutes,subjects(name))").eq("student_id",student.id).order("assigned_at",{ascending:false}).limit(120),
    supabase.from("notebook_assignments").select("id,status,due_at,needs_redo,notebook_activities(title,description,subjects(name))").eq("student_id",student.id).order("created_at",{ascending:false}).limit(60),
    supabase.from("student_game_profiles").select("stars,streak_days,level_name").eq("student_id",student.id).maybeSingle(),
    supabase.from("assessment_students").select("id,status,assessments(title,scheduled_for,subjects(name))").eq("student_id",student.id).limit(40),
    supabase.from("student_achievements").select("achievement_id,earned_at,achievements(name,description,icon)").eq("student_id",student.id).order("earned_at",{ascending:false}).limit(1),
    supabase.from("daily_tips").select("id,text").eq("active",true).limit(100),
    supabase.from("agenda_event_students").select("event_id,agenda_events(id,title,description,event_type,starts_at,status,meeting_url,location,visible_to_student)").eq("student_id",student.id).limit(60),
    supabase.from("student_achievements").select("achievement_id",{count:"exact",head:true}).eq("student_id",student.id),
  ]);

  const missions=(missionRows??[]).map((row:any)=>({...row,mission:relation(row.missions)}));
  const pendingMissions=missions.filter((row:any)=>["assigned","in_progress"].includes(row.status));
  const completedMissions=missions.filter((row:any)=>row.status==="reviewed");
  const pendingNotebooks=(notebooks??[]).filter((row:any)=>["assigned","in_progress"].includes(row.status)||row.needs_redo);
  const week=startOfWeek(); const nextWeek=new Date(week);nextWeek.setDate(nextWeek.getDate()+7);
  const weekRows=missions.filter((row:any)=>{const d=new Date(row.completed_at||row.assigned_at);return d>=week&&d<nextWeek;});
  const weekDone=weekRows.filter((row:any)=>row.status==="reviewed").length;
  const weekProgress=weekRows.length?Math.round(weekDone/weekRows.length*100):0;
  const grade:any=relation((student as any).grades);

  const upcomingAssessments=(assessments??[]).map((row:any)=>({row,assessment:relation(row.assessments)})).filter((item:any)=>item.assessment?.scheduled_for&&new Date(item.assessment.scheduled_for)>=now).sort((a:any,b:any)=>+new Date(a.assessment.scheduled_for)-+new Date(b.assessment.scheduled_for));
  const nextAssessment=upcomingAssessments[0]?.assessment;
  const events=(agendaLinks??[]).map((row:any)=>relation(row.agenda_events)).filter((event:any)=>event?.visible_to_student&&event.status!=="cancelled"&&new Date(event.starts_at)>=now).sort((a:any,b:any)=>+new Date(a.starts_at)-+new Date(b.starts_at));
  const nextEvent:any=events[0];
  const recentAchievement:any=achievementRows?.[0];
  const dayIndex=Math.floor(Date.now()/86400000); const tip=(tips??[]).length?(tips??[])[dayIndex%(tips??[]).length]?.text:null;

  return <>
    <section className="kid-hero kid-hero-rich student-hero-refresh">
      <div className="kid-hero-copy">
        <div className="eyebrow" style={{color:"#dfffa8"}}>Portal do Aluno</div>
        <h1>Oi, {student.preferred_name}!</h1>
        <p>Pronto para mais uma descoberta? Hoje o CURIÓ separou o que merece sua atenção.</p>
        <div className="student-today-pills">
          <span><UiIcon label="Missões"/>Missões</span>
          <span><UiIcon label="Meu Caderno"/>Atividades</span>
          <span><UiIcon label="Caminho"/>Dica do dia</span>
          <span><UiIcon label="Descobertas"/>Descobertas</span>
        </div>
      </div>
      <div className="student-hero-stage" aria-hidden="true">
        <span className="student-hero-orbit student-hero-orbit-one" />
        <span className="student-hero-orbit student-hero-orbit-two" />
        <Image className="student-hero-character" src="/mascotes/curio_capivara_principal_acolhendo.png" alt="" width={290} height={290} priority />
      </div>
    </section>

    <div className="student-home-stats">
      <article><UiIcon label="Missões"/><strong>{game?.stars??0}</strong><small>Estrelas</small></article>
      <article><UiIcon label="Caminho"/><strong>{game?.streak_days??0}</strong><small>Dias seguidos</small></article>
      <article><UiIcon label="Turmas"/><strong>{grade?.name||"—"}</strong><small>Série</small></article>
      <article><UiIcon label="Correções"/><strong>{completedMissions.length}</strong><small>Missões concluídas</small></article>
    </div>

    <div className="student-home-stats student-home-stats-secondary">
      <article><strong>{weekRows.length?`${weekProgress}%`:"—"}</strong><small>Progresso da semana</small></article>
      <article><strong>{pendingMissions.length}</strong><small>Missões para fazer</small></article>
      <article><strong>{achievementCount??0}</strong><small>Conquistas</small></article>
      <article><strong>{game?.level_name||"Curioso"}</strong><small>Nível</small></article>
    </div>

    {nextEvent ? <section className="panel student-next-event"><div className="panel-head"><div><h2 className="student-heading-with-icon"><UiIcon label="Agenda"/>Próximo encontro</h2><p>{dt(nextEvent.starts_at)}</p></div><Link href="/aluno/agenda">Ver agenda</Link></div><div className="student-inline-event"><div><Badge tone="blue">{nextEvent.event_type==="class"?"Aula":"Encontro"}</Badge><h3>{nextEvent.title}</h3><p>{nextEvent.description||nextEvent.location||"Encontro Curió"}</p></div>{nextEvent.meeting_url?<a className="button button-primary" href={nextEvent.meeting_url} target="_blank" rel="noreferrer">Entrar na aula</a>:null}</div></section> : null}

    <section className="panel"><div className="panel-head"><div><h2 className="student-heading-with-icon"><UiIcon label="Missões"/>Suas missões de hoje</h2><p>Comece por onde quiser. Cada missão te leva um passo adiante.</p></div><Link href="/aluno/missoes">Ver todas</Link></div>{pendingMissions.length?<div className="mission-list-grid">{pendingMissions.slice(0,6).map((item:any)=>{const subject:any=relation(item.mission?.subjects);return <Link className="mission-card mission-card-clickable" href={`/aluno/missoes/${item.id}`} key={item.id}><div className="flex space-between gap-8 wrap"><Badge tone="pink">{subject?.name||"Missão Cuca"}</Badge><Badge tone={item.status==="in_progress"?"yellow":"blue"}>{item.status==="in_progress"?"Em andamento":"Começar"}</Badge></div><h3>{item.mission?.title||"Missão Cuca"}</h3><p>{item.mission?.objective||"Uma nova descoberta está esperando por você."}</p>{item.status==="in_progress"?<div className="progress"><span style={{width:`${item.progress_percent||0}%`}} /></div>:null}<small className="muted">{item.due_at?`Prazo: ${dt(item.due_at)}`:`${item.mission?.estimated_minutes||20} min`}</small></Link>})}</div>:<EmptyState title="Tudo em dia!" description="Nenhuma Missão Cuca pendente neste momento." />}</section>

    <section className="panel"><div className="panel-head"><div><h2 className="student-heading-with-icon"><UiIcon label="Meu Caderno"/>Meu Caderno</h2><p>Atividades para fazer à mão e enviar uma foto quando terminar.</p></div><Link href="/aluno/caderno">Abrir Meu Caderno</Link></div>{pendingNotebooks.length?<div className="student-notebook-strip">{pendingNotebooks.slice(0,4).map((row:any)=>{const activity:any=relation(row.notebook_activities);const subject:any=relation(activity?.subjects);return <Link href="/aluno/caderno" className="student-notebook-mini" key={row.id}><Badge tone={row.needs_redo?"pink":"purple"}>{row.needs_redo?"Para refazer":subject?.name||"Caderno"}</Badge><h3>{activity?.title||"Atividade do Caderno"}</h3><p>{activity?.description||"Faça no caderno e envie sua atividade."}</p><small>{row.due_at?`Prazo: ${dt(row.due_at)}`:"Sem prazo"}</small></Link>})}</div>:<p className="muted">Nenhuma atividade de caderno pendente.</p>}</section>

    <div className="grid-2">
      <section className="panel"><div className="panel-head"><div><h2 className="student-heading-with-icon"><UiIcon label="Avaliações"/>Próxima avaliação</h2><p>Saiba o que vem por aí.</p></div><Link href="/aluno/modo-prova">Modo Prova</Link></div>{nextAssessment?<div className="mission-card"><Badge tone="blue">{relation<any>(nextAssessment.subjects)?.name||"Avaliação"}</Badge><h3>{nextAssessment.title}</h3><p>Marcada para {dt(nextAssessment.scheduled_for)}</p></div>:<p className="muted">Nenhuma avaliação próxima.</p>}</section>
      <section className="panel"><div className="panel-head"><div><h2 className="student-heading-with-icon"><UiIcon label="Conquistas"/>Conquista recente</h2><p>Seu mural vai crescendo junto com você.</p></div><Link href="/aluno/conquistas">Ver conquistas</Link></div>{recentAchievement?<div className="achievement-inline"><span className="student-achievement-symbol"><UiIcon label="Conquistas"/></span><div><strong>{relation<any>(recentAchievement.achievements)?.name}</strong><p>{relation<any>(recentAchievement.achievements)?.description}</p></div></div>:<p className="muted">Sua primeira conquista está chegando.</p>}</section>
    </div>

    <section className="panel tip-card student-tip-card-refresh"><Image className="student-tip-character" src="/mascotes/curio_tamandua_avatar_neutro.png" alt="Tamanduá do Curió" width={120} height={120}/><div><div className="eyebrow">Dica do dia</div><h2>Pequenos passos fazem diferença.</h2><p>{tip||"Antes de responder, descubra exatamente o que a questão está pedindo."}</p><Link href="/aluno/caminho">Ver meu caminho</Link></div></section>
  </>;
}
