import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentStudent } from "@/lib/student";

function relation<T=any>(value:any):T|null{return (Array.isArray(value)?value[0]:value)||null;}
function dt(value?:string|null){if(!value)return"Data a confirmar";return new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Bahia"}).format(new Date(value));}

export default async function StudentTestModePage(){
  const {student,supabase}=await getCurrentStudent();
  const {data:rows}=await supabase.from("assessment_students").select("id,status,score,started_at,submitted_at,reviewed_at,assessments(title,instructions,scheduled_for,file_path,subjects(name))").eq("student_id",student.id).order("created_at",{ascending:false}).limit(80);
  const files=new Map<string,string>();
  for(const row of rows??[]){const assessment:any=relation((row as any).assessments);if(assessment?.file_path){const {data}=await supabase.storage.from("teacher-materials").createSignedUrl(assessment.file_path,60*20);if(data?.signedUrl)files.set(row.id,data.signedUrl);}}
  const upcoming=(rows??[]).filter((row:any)=>{const a:any=relation(row.assessments);return row.status==="assigned"&&(!a?.scheduled_for||new Date(a.scheduled_for)>=new Date());});
  const history=(rows??[]).filter((row:any)=>row.status!=="assigned"||!upcoming.includes(row));
  const card=(row:any)=>{const assessment:any=relation(row.assessments);const subject:any=relation(assessment?.subjects);return <article className="student-test-card" key={row.id}><div className="flex space-between gap-8 wrap"><div className="flex gap-8 wrap"><Badge tone="blue">{subject?.name||"Avaliação"}</Badge><Badge tone={row.status==="reviewed"?"green":row.status==="submitted"?"yellow":"purple"}>{row.status==="assigned"?"Próxima":row.status==="submitted"?"Enviada":row.status==="reviewed"?"Corrigida":row.status}</Badge></div>{row.score!=null?<Badge tone="green">Nota {row.score}</Badge>:null}</div><h3>{assessment?.title||"Avaliação"}</h3><p>{assessment?.instructions||"Revise o conteúdo com calma e organize seus materiais."}</p><small className="muted">{dt(assessment?.scheduled_for)}</small>{files.get(row.id)?<div className="mt-12"><a className="button button-secondary button-small" href={files.get(row.id)} target="_blank" rel="noreferrer">Abrir arquivo da avaliação ↗</a></div>:null}</article>;};
  return <>
    <PageHeader eyebrow="Explorador Curió" title="Modo Prova" description="Veja as próximas avaliações, organize sua revisão e acompanhe os resultados que a professora publicar."/>
    <section className="student-test-intro"><span>📝</span><div><h2>Preparar também é aprender.</h2><p>Confira a data, o conteúdo e o arquivo da avaliação. O CURIÓ não inventa uma nota antes da correção da professora.</p></div></section>
    <section className="panel"><div className="panel-head"><div><h2>Próximas avaliações</h2><p>O que já está marcado para você.</p></div></div>{upcoming.length?<div className="student-test-grid">{upcoming.map(card)}</div>:<EmptyState title="Nenhuma avaliação próxima" description="Quando a professora marcar uma avaliação, ela aparecerá aqui."/>}</section>
    <section className="panel"><div className="panel-head"><div><h2>Histórico</h2><p>Avaliações já enviadas, corrigidas ou anteriores.</p></div></div>{history.length?<div className="student-test-grid">{history.slice(0,40).map(card)}</div>:<p className="muted">Seu histórico ainda está vazio.</p>}</section>
  </>;
}
