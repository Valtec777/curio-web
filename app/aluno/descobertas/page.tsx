import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentStudent } from "@/lib/student";

function relation<T=any>(value:any):T|null{return (Array.isArray(value)?value[0]:value)||null;}

type LibraryItem={id:string;title:string;description:string;subject:string;type:"Missão"|"Caderno"|"PDF / Material"|"Avaliação";href?:string|null;date?:string|null};

export default async function StudentDiscoveriesPage({searchParams}:{searchParams:Promise<{q?:string;materia?:string;tipo?:string}>}){
  const query=await searchParams;
  const {student,supabase}=await getCurrentStudent();
  const [{data:missions},{data:notebooks},{data:materials},{data:assessments}]=await Promise.all([
    supabase.from("mission_students").select("id,status,completed_at,missions(title,objective,subjects(name))").eq("student_id",student.id).eq("status","reviewed").order("completed_at",{ascending:false}).limit(150),
    supabase.from("notebook_assignments").select("id,status,submitted_at,notebook_activities(title,description,worksheet_path,subjects(name))").eq("student_id",student.id).in("status",["submitted","reviewed"]).order("submitted_at",{ascending:false}).limit(120),
    supabase.from("material_assignments").select("id,assigned_at,materials(title,description,file_path,external_url,material_type,subjects(name))").eq("student_id",student.id).order("assigned_at",{ascending:false}).limit(120),
    supabase.from("assessment_students").select("id,status,reviewed_at,assessments(title,instructions,file_path,subjects(name))").eq("student_id",student.id).in("status",["submitted","reviewed"]).limit(80),
  ]);

  const items:LibraryItem[]=[];
  for(const row of missions??[]){const mission:any=relation((row as any).missions);const subject:any=relation(mission?.subjects);items.push({id:`m-${row.id}`,title:mission?.title||"Missão Cuca",description:mission?.objective||"Missão concluída",subject:subject?.name||"Sem matéria",type:"Missão",href:`/aluno/missoes/${row.id}`,date:row.completed_at});}
  for(const row of notebooks??[]){const activity:any=relation((row as any).notebook_activities);const subject:any=relation(activity?.subjects);let href:string|null=null;if(activity?.worksheet_path){const {data}=await supabase.storage.from("teacher-materials").createSignedUrl(activity.worksheet_path,60*20);href=data?.signedUrl||null;}items.push({id:`n-${row.id}`,title:activity?.title||"Caderno Plumareli",description:activity?.description||"Atividade de caderno",subject:subject?.name||"Sem matéria",type:"Caderno",href,date:row.submitted_at});}
  for(const row of materials??[]){const material:any=relation((row as any).materials);const subject:any=relation(material?.subjects);let href=material?.external_url||null;if(material?.file_path){const {data}=await supabase.storage.from("teacher-materials").createSignedUrl(material.file_path,60*20);href=data?.signedUrl||href;}items.push({id:`matt-${row.id}`,title:material?.title||"Material",description:material?.description||"Material de apoio",subject:subject?.name||"Sem matéria",type:"PDF / Material",href,date:row.assigned_at});}
  for(const row of assessments??[]){const assessment:any=relation((row as any).assessments);const subject:any=relation(assessment?.subjects);let href:string|null=null;if(assessment?.file_path){const {data}=await supabase.storage.from("teacher-materials").createSignedUrl(assessment.file_path,60*20);href=data?.signedUrl||null;}items.push({id:`a-${row.id}`,title:assessment?.title||"Avaliação",description:assessment?.instructions||"Avaliação concluída",subject:subject?.name||"Sem matéria",type:"Avaliação",href,date:row.reviewed_at});}

  items.sort((a,b)=>+(new Date(b.date||0))-(+new Date(a.date||0)));
  const subjects=[...new Set(items.map(i=>i.subject))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const q=String(query.q||"").trim().toLocaleLowerCase("pt-BR");
  const filtered=items.filter(item=>(!q||`${item.title} ${item.description}`.toLocaleLowerCase("pt-BR").includes(q))&&(!query.materia||query.materia==="todas"||item.subject===query.materia)&&(!query.tipo||query.tipo==="todos"||item.type===query.tipo));

  return <>
    <PageHeader eyebrow="Explorador Plumareli" title="Biblioteca Plumareli" description="Tudo que você já explorou e pode revisar quando quiser." />
    <section className="panel student-filter-panel"><form method="get" className="student-library-filters"><div className="field"><label>Pesquisar</label><input className="input" name="q" defaultValue={query.q||""} placeholder="Buscar missão, caderno ou material"/></div><div className="field"><label>Matéria</label><select className="select" name="materia" defaultValue={query.materia||"todas"}><option value="todas">Todas as matérias</option>{subjects.map(s=><option key={s} value={s}>{s}</option>)}</select></div><div className="field"><label>Tipo</label><select className="select" name="tipo" defaultValue={query.tipo||"todos"}><option value="todos">Todos os tipos</option><option>Missão</option><option>Caderno</option><option>PDF / Material</option><option>Avaliação</option></select></div><button className="button button-primary" type="submit">Filtrar</button></form></section>
    {filtered.length?<div className="student-library-grid">{filtered.map(item=><article className="student-library-card" key={item.id}><div className="flex gap-8 wrap"><Badge tone={item.type==="Missão"?"pink":item.type==="Caderno"?"purple":item.type==="Avaliação"?"yellow":"blue"}>{item.type}</Badge><Badge tone="neutral">{item.subject}</Badge></div><h3>{item.title}</h3><p>{item.description}</p>{item.href?(item.href.startsWith("/aluno")?<Link className="button button-secondary button-small" href={item.href}>Revisar →</Link>:<a className="button button-secondary button-small" href={item.href} target="_blank" rel="noreferrer">Abrir novamente ↗</a>):<small className="muted">Este item não possui arquivo para abrir novamente.</small>}</article>)}</div>:<EmptyState title="Nenhuma descoberta neste filtro" description="Tente pesquisar outro nome, matéria ou tipo." />}
  </>;
}
