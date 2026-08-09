import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Badge, StatCard } from "@/components/ui";
import { enterStudentSpace } from "@/app/familia/access-actions";

function progressLabel(level:number,count:number){ if(count<2)return "Nova habilidade"; if(level>=4)return "Consolidado"; if(level>=3)return "Praticando com autonomia"; return "Em desenvolvimento"; }

export default async function FamilyPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const viewer = await requireRole("guardian");
  const supabase = await createClient();
  const { data: guardian } = await supabase.from("guardians").select("id").eq("profile_id", viewer.user.id).maybeSingle();
  if (!guardian) return <EmptyState title="Perfil da família incompleto" description="Falta concluir o registro de responsável." />;
  const { data: links } = await supabase.from("guardian_students").select("student_id,can_view_progress,students(id,preferred_name,full_name,school_name,grades(name))").eq("guardian_id", guardian.id);
  if (!links?.length) return <><PageHeader eyebrow="Ninho da Família" title="Acompanhando" description="Uma visão acolhedora e objetiva da jornada escolar."/><EmptyState title="Nenhuma criança vinculada" description="A administração precisa aprovar o vínculo da família com a criança." /></>;

  const visibleIds = links.filter((l:any)=>l.can_view_progress).map((l:any)=>l.student_id);
  const childName = new Map(links.map((l:any)=>[l.student_id,l.students?.preferred_name||l.students?.full_name||"Criança"]));
  const [{ data: states }, { data: currentContents }, { data: missions }, { data: assessments }] = visibleIds.length ? await Promise.all([
    supabase.from("student_skill_states").select("student_id,domain_level,confidence,trend,evidence_count,skills(name)").in("student_id",visibleIds).order("updated_at",{ascending:false}).limit(80),
    supabase.from("student_current_contents").select("student_id,confirmed,is_manual,subjects(name),contents(name)").in("student_id",visibleIds).eq("active",true).limit(30),
    supabase.from("mission_students").select("student_id,status,progress_percent").in("student_id",visibleIds).in("status",["assigned","in_progress"]).limit(100),
    supabase.from("assessment_students").select("student_id,status,assessments(scheduled_for)").in("student_id",visibleIds).limit(50),
  ]) : [{data:[] as any[]},{data:[] as any[]},{data:[] as any[]},{data:[] as any[]}];

  const improving=(states??[]).filter((s:any)=>s.trend==="improving").length;
  const developing=(states??[]).filter((s:any)=>s.evidence_count>=2&&s.domain_level<3).length;
  const consolidated=(states??[]).filter((s:any)=>s.evidence_count>=2&&s.domain_level>=3).length;

  return <>
    <PageHeader eyebrow="Ninho da Família" title="Acompanhando" description="Veja conteúdos, atividades e evolução com linguagem adequada para a família." />
    {query.erro && <div className="form-message form-error">{query.erro}</div>}
    {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
    <section className="panel family-child-switcher">
      <div className="panel-head"><div><div className="eyebrow eyebrow-pink">Espaço da criança</div><h2>Quem vai estudar agora?</h2><p>O acesso da criança usa este mesmo login. Para voltar ao Ninho da Família, o Curió pede o PIN de 4 números.</p></div></div>
      <div className="family-child-buttons">
        {links.map((link:any) => (
          <form action={enterStudentSpace} key={link.student_id}>
            <input type="hidden" name="studentId" value={link.student_id} />
            <button className="child-space-button" type="submit">
              <span className="child-space-avatar" aria-hidden="true">{String(link.students?.preferred_name || link.students?.full_name || "C").slice(0,1).toUpperCase()}</span>
              <span><strong>Entrar como {link.students?.preferred_name || link.students?.full_name || "criança"}</strong><small>{link.students?.grades?.name || "Ano escolar"} · Espaço protegido</small></span>
              <b aria-hidden="true">→</b>
            </button>
          </form>
        ))}
      </div>
    </section>
    <div className="stats-grid"><StatCard value={links.length} label={links.length===1?"Criança":"Crianças"}/><StatCard value={missions?.length??0} label="Atividades em andamento"/><StatCard value={improving} label="Evoluções recentes"/><StatCard value={developing} label="Em desenvolvimento"/></div>
    <section className="panel"><div className="panel-head"><div><h2>Estudando agora</h2><p>Conteúdos podem ser sugeridos automaticamente e confirmados pela professora.</p></div></div>{currentContents?.length?<div className="grid-3">{currentContents.map((item:any,index)=><article className="mission-card" key={index}><Badge tone={item.confirmed||item.is_manual?"green":"yellow"}>{item.confirmed||item.is_manual?"Confirmado":"Sugestão"}</Badge><h3>{item.contents?.name||"Conteúdo"}</h3><p>{item.subjects?.name||"Matéria"} • {childName.get(item.student_id)}</p></article>)}</div>:<p className="muted">Os conteúdos atuais aparecerão conforme o acompanhamento for avançando.</p>}</section>
    <section className="panel"><div className="panel-head"><div><h2>Progresso por habilidade</h2><p>Não mostramos rótulos como “fraco”. O foco é o que já está consolidado e o que está em desenvolvimento.</p></div></div>{states?.length?<div className="grid-3">{states.slice(0,12).map((state:any,index)=><article className="mission-card" key={index}><strong>{state.skills?.name}</strong><p>{childName.get(state.student_id)}</p><Badge tone={state.evidence_count<2?"neutral":state.domain_level>=3?"green":"yellow"}>{progressLabel(state.domain_level,state.evidence_count)}</Badge></article>)}</div>:<EmptyState title="O ciclo está começando" description="O progresso aparecerá quando houver evidências suficientes."/>}</section>
    <div className="grid-2"><section className="panel"><h2 className="mt-0">Resumo</h2><div className="profile-lines"><div><span>Habilidades consolidadas/praticando</span><strong>{consolidated}</strong></div><div><span>Em desenvolvimento</span><strong>{developing}</strong></div><div><span>Missões abertas</span><strong>{missions?.length??0}</strong></div></div></section><section className="panel family-highlight"><h2 className="mt-0">Avaliações</h2><p>{assessments?.length ? `${assessments.length} avaliação(ões) vinculada(s) ao acompanhamento.` : "Nenhuma avaliação vinculada no momento."}</p><a href="/familia/avaliacoes">Abrir avaliações →</a></section></div>
  </>;
}
