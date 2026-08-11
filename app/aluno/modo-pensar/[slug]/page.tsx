import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHeader } from "@/components/ui";
import { CurioIcon } from "@/components/nav-icon";
import { getCurrentStudent } from "@/lib/student";
import { completeStudentCourseModule, startStudentCourse } from "../actions";

async function resourceUrl(supabase:any,path?:string|null){
  if(!path)return null;
  if(/^https?:\/\//i.test(path))return path;
  for(const bucket of ["generated-documents","teacher-materials"]){
    const {data}=await supabase.storage.from(bucket).createSignedUrl(path,60*20);
    if(data?.signedUrl)return data.signedUrl;
  }
  return null;
}

export default async function StudentCourseDetail({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{erro?:string;sucesso?:string}>}){
  const {slug}=await params; const query=await searchParams;
  const {student,supabase}=await getCurrentStudent();
  const {data:course}=await supabase.from("free_courses").select("id,title,slug,summary,description,audience_label,estimated_minutes,certificate_enabled").eq("slug",slug).eq("status","published").maybeSingle();
  if(!course)notFound();
  const [{data:modules},{data:enrollment}]=await Promise.all([
    supabase.from("free_course_modules").select("id,title,description,body,resource_type,external_url,file_path,position,duration_minutes,required").eq("course_id",course.id).order("position"),
    supabase.from("free_course_enrollments").select("id,status,progress_percent,completed_at").eq("course_id",course.id).eq("student_id",student.id).maybeSingle(),
  ]);
  const [{data:progressRows},{data:certificate}]=enrollment?await Promise.all([
    supabase.from("free_course_module_progress").select("module_id,completed_at").eq("enrollment_id",enrollment.id),
    supabase.from("free_course_certificates").select("certificate_code,issued_at,file_path").eq("enrollment_id",enrollment.id).maybeSingle(),
  ]):[{data:[]},{data:null}] as any;
  const done=new Set((progressRows??[]).map((row:any)=>row.module_id));
  const resources=new Map<string,string>();
  for(const module of modules??[]){const url=await resourceUrl(supabase,module.file_path);if(url)resources.set(module.id,url);}
  const certificateUrl=await resourceUrl(supabase,certificate?.file_path);

  return <>
    <PageHeader eyebrow="Modo Pensar" title={course.title} description={course.summary||course.description||"Uma trilha para aprender no seu ritmo."}/>
    {query.erro&&<div className="form-message form-error">{query.erro}</div>}{query.sucesso&&<div className="form-message form-success">{query.sucesso}</div>}
    <section className="student-course-progress-card"><div><span className="student-kicker">Seu progresso</span><h2>{enrollment?`${enrollment.progress_percent}%`:"Ainda não iniciado"}</h2><div className="student-big-progress"><span style={{width:`${enrollment?.progress_percent||0}%`}}/></div><p>{course.audience_label||"Trilha extra"} · cerca de {course.estimated_minutes} min</p></div>{!enrollment?<form action={startStudentCourse}><input type="hidden" name="courseId" value={course.id}/><input type="hidden" name="slug" value={course.slug}/><button className="button button-primary" type="submit">Começar agora</button></form>:enrollment.status==="completed"?<Badge tone="green">Trilha concluída</Badge>:<Badge tone="blue">Em andamento</Badge>}</section>
    <div className="student-course-modules">{(modules??[]).map((module:any)=>{const complete=done.has(module.id);return <article className={`student-course-module${complete?" is-complete":""}`} key={module.id}><div className="student-module-number">{complete?"✓":module.position}</div><div className="student-course-content"><div className="flex gap-8 wrap"><Badge tone={complete?"green":"purple"}>{complete?"Concluída":"Etapa"}</Badge><Badge tone="neutral">{module.duration_minutes} min</Badge>{!module.required?<Badge tone="neutral">Opcional</Badge>:null}</div><h2>{module.title}</h2>{module.description?<p>{module.description}</p>:null}{module.body?<div className="student-course-body">{module.body}</div>:null}<div className="flex gap-8 wrap mt-12">{module.external_url?<a className="button button-secondary button-small" href={module.external_url} target="_blank" rel="noreferrer">{module.resource_type==="video"?"Assistir vídeo":"Abrir recurso"}</a>:null}{resources.get(module.id)?<a className="button button-secondary button-small" href={resources.get(module.id)} target="_blank" rel="noreferrer">Abrir PDF / arquivo</a>:null}</div>{enrollment&&!complete?<form action={completeStudentCourseModule} className="mt-16"><input type="hidden" name="moduleId" value={module.id}/><input type="hidden" name="slug" value={course.slug}/><button className="button button-primary button-small" type="submit">Concluir esta etapa</button></form>:null}</div></article>})}</div>
    {enrollment?.status==="completed"&&course.certificate_enabled?<section className="panel student-certificate-card"><div className="student-certificate-copy"><span className="student-certificate-icon"><CurioIcon name="trophy" /></span><div><span className="student-kicker">Conquista especial</span><h2>Seu certificado está registrado</h2><p>Código: <strong>{certificate?.certificate_code||"em preparação"}</strong></p></div></div>{certificateUrl?<a className="button button-primary" href={certificateUrl} target="_blank" rel="noreferrer">Abrir certificado</a>:null}</section>:null}
    <p><Link href="/aluno/modo-pensar">← Voltar ao Modo Pensar</Link></p>
  </>;
}
