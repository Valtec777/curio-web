import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { CurioIcon } from "@/components/nav-icon";
import { getCurrentStudent } from "@/lib/student";
import { startStudentCourse } from "./actions";

export default async function StudentFreeCoursesPage({searchParams}:{searchParams:Promise<{erro?:string}>}){
  const query=await searchParams;
  const {student,supabase}=await getCurrentStudent();
  const [{data:courses},{data:enrollments}]=await Promise.all([
    supabase.from("free_courses").select("id,title,slug,summary,description,audience_label,estimated_minutes,certificate_enabled,published_at").eq("status","published").order("published_at",{ascending:false}),
    supabase.from("free_course_enrollments").select("id,course_id,status,progress_percent,completed_at").eq("student_id",student.id),
  ]);
  const enrollmentMap=new Map((enrollments??[]).map((e:any)=>[e.course_id,e]));

  return <>
    <PageHeader eyebrow="Modo Pensar" title="Trilhas para aprender além da escola" description="Idiomas, comunicação, tecnologia, organização, criatividade e outros conhecimentos úteis para a vida." />
    {query.erro&&<div className="form-message form-error">{query.erro}</div>}
    <section className="student-courses-intro"><div><span className="student-kicker">Aprender além da escola</span><h2>Escolha uma curiosidade e vá no seu ritmo.</h2><p>As trilhas podem misturar vídeo, texto, slides, PDFs, links e pequenas práticas. Seu progresso fica salvo para continuar depois.</p></div><span className="student-course-hero-icon"><CurioIcon name="brain" /></span></section>
    {courses?.length?<div className="student-course-grid">{courses.map((course:any)=>{const enrollment:any=enrollmentMap.get(course.id);return <article className="student-course-card" key={course.id}><div className="flex gap-8 wrap"><Badge tone="purple">Trilha extra</Badge>{course.certificate_enabled?<Badge tone="yellow">Certificado</Badge>:null}{enrollment?.status==="completed"?<Badge tone="green">Concluído</Badge>:enrollment?<Badge tone="blue">{enrollment.progress_percent}% feito</Badge>:null}</div><h3>{course.title}</h3><p>{course.summary||course.description||"Uma nova trilha para explorar."}</p><small className="muted">{course.audience_label||"Crianças e adolescentes"} · cerca de {course.estimated_minutes} min</small><div className="mt-16">{enrollment?<Link className="button button-primary" href={`/aluno/modo-pensar/${course.slug}`}>{enrollment.status==="completed"?"Revisar trilha":"Continuar trilha"}</Link>:<form action={startStudentCourse}><input type="hidden" name="courseId" value={course.id}/><input type="hidden" name="slug" value={course.slug}/><button className="button button-primary" type="submit">Começar trilha</button></form>}</div></article>})}</div>:<EmptyState title="Novas trilhas estão sendo preparadas" description="Quando uma trilha extra for publicada, ela aparecerá aqui." />}
  </>;
}
