import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHeader } from "@/components/ui";
import { CurioIcon } from "@/components/nav-icon";
import { getCurrentStudent } from "@/lib/student";
import { completeStudentCourseModule, startStudentCourse } from "../actions";

async function resourceUrl(supabase: any, path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  for (const bucket of ["generated-documents", "teacher-materials"]) {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 20);
    if (data?.signedUrl) return data.signedUrl;
  }
  return null;
}

function blockButtonLabel(block: any) {
  const config = block?.config && typeof block.config === "object" ? block.config : {};
  return config.button_label || (block.block_type === "video" ? "Assistir" : block.block_type === "download" ? "Abrir arquivo" : "Abrir recurso");
}

export default async function StudentCourseDetail({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const { student, supabase } = await getCurrentStudent();
  const { data: course } = await supabase
    .from("free_courses")
    .select("id,title,slug,summary,description,cover_image_path,category,audience_label,age_label,level_label,objective,estimated_minutes,certificate_enabled")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!course) notFound();

  const [{ data: modules }, { data: enrollment }] = await Promise.all([
    supabase.from("free_course_modules").select("id,title,description,body,resource_type,external_url,file_path,position,duration_minutes,required,status").eq("course_id", course.id).eq("status", "published").order("position"),
    supabase.from("free_course_enrollments").select("id,status,progress_percent,completed_at").eq("course_id", course.id).eq("student_id", student.id).maybeSingle(),
  ]);
  const moduleIds = (modules ?? []).map((m: any) => m.id);
  const { data: blocks } = moduleIds.length
    ? await supabase.from("free_course_module_blocks").select("id,module_id,block_type,title,body,external_url,file_path,linked_mission_id,position,status,config").in("module_id", moduleIds).eq("status", "published").order("position")
    : { data: [] as any[] };

  const [{ data: progressRows }, { data: certificate }] = enrollment
    ? await Promise.all([
        supabase.from("free_course_module_progress").select("module_id,completed_at").eq("enrollment_id", enrollment.id),
        supabase.from("free_course_certificates").select("certificate_code,issued_at,file_path").eq("enrollment_id", enrollment.id).maybeSingle(),
      ])
    : [{ data: [] }, { data: null }] as any;

  const blocksByModule = new Map<string, any[]>();
  for (const block of blocks ?? []) blocksByModule.set(block.module_id, [...(blocksByModule.get(block.module_id) || []), block]);
  const done = new Set((progressRows ?? []).map((row: any) => row.module_id));
  const resources = new Map<string, string>();
  const coverUrl = await resourceUrl(supabase, course.cover_image_path);
  for (const module of modules ?? []) {
    const url = await resourceUrl(supabase, module.file_path);
    if (url) resources.set(`module:${module.id}`, url);
  }
  for (const block of blocks ?? []) {
    const url = await resourceUrl(supabase, block.file_path);
    if (url) resources.set(`block:${block.id}`, url);
  }
  const certificateUrl = await resourceUrl(supabase, certificate?.file_path);

  return <>
    <PageHeader eyebrow="Modo Pensar" title={course.title} description={course.summary || course.description || "Uma trilha para aprender no seu ritmo."} />
    {query.erro && <div className="form-message form-error">{query.erro}</div>}
    {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

    <section className="panel student-course-intro">
      <div className="grid-2">
        <div>
          <div className="flex gap-8 wrap">{course.category && <Badge tone="purple">{course.category}</Badge>}{course.age_label && <Badge tone="blue">{course.age_label}</Badge>}{course.level_label && <Badge tone="neutral">{course.level_label}</Badge>}</div>
          {course.description && <p>{course.description}</p>}
          {course.objective && <div className="notice"><strong>O que você vai desenvolver</strong><p className="mb-0">{course.objective}</p></div>}
        </div>
        {coverUrl ? <div className="student-course-cover"><img src={coverUrl} alt={`Capa da trilha ${course.title}`} /></div> : null}
      </div>
    </section>

    <section className="student-course-progress-card">
      <div><span className="student-kicker">Seu progresso</span><h2>{enrollment ? `${enrollment.progress_percent}%` : "Ainda não iniciado"}</h2><div className="student-big-progress"><span style={{ width: `${enrollment?.progress_percent || 0}%` }} /></div><p>{course.audience_label || "Trilha extra"} · cerca de {course.estimated_minutes} min</p></div>
      {!enrollment ? <form action={startStudentCourse}><input type="hidden" name="courseId" value={course.id} /><input type="hidden" name="slug" value={course.slug} /><button className="button button-primary" type="submit">Começar agora</button></form> : enrollment.status === "completed" ? <Badge tone="green">Trilha concluída</Badge> : <Badge tone="blue">Em andamento</Badge>}
    </section>

    <div className="student-course-modules">{(modules ?? []).map((module: any) => {
      const complete = done.has(module.id);
      const moduleBlocks = blocksByModule.get(module.id) || [];
      return <article className={`student-course-module${complete ? " is-complete" : ""}`} key={module.id}>
        <div className="student-module-number">{complete ? "✓" : module.position}</div>
        <div className="student-course-content">
          <div className="flex gap-8 wrap"><Badge tone={complete ? "green" : "purple"}>{complete ? "Concluída" : "Etapa"}</Badge><Badge tone="neutral">{module.duration_minutes} min</Badge>{!module.required ? <Badge tone="neutral">Opcional</Badge> : null}</div>
          <h2>{module.title}</h2>{module.description ? <p>{module.description}</p> : null}{module.body ? <div className="student-course-body">{module.body}</div> : null}
          <div className="flex gap-8 wrap mt-12">{module.external_url ? <a className="button button-secondary button-small" href={module.external_url} target="_blank" rel="noreferrer">{module.resource_type === "video" ? "Assistir vídeo" : "Abrir recurso"}</a> : null}{resources.get(`module:${module.id}`) ? <a className="button button-secondary button-small" href={resources.get(`module:${module.id}`)} target="_blank" rel="noreferrer">Abrir PDF / arquivo</a> : null}</div>

          {moduleBlocks.length ? <div className="student-course-blocks mt-16">{moduleBlocks.map((block: any) => {
            const fileUrl = resources.get(`block:${block.id}`);
            if (block.block_type === "text") return <section className="student-course-block" key={block.id}>{block.title && <h3>{block.title}</h3>}{block.body && <p>{block.body}</p>}</section>;
            if (block.block_type === "image") return <section className="student-course-block" key={block.id}>{block.title && <h3>{block.title}</h3>}{fileUrl ? <img className="student-course-block-image" src={fileUrl} alt={block.title || "Imagem da etapa"} /> : null}{block.body && <p>{block.body}</p>}</section>;
            if (block.block_type === "quiz" || block.block_type === "activity") return <section className="student-course-block" key={block.id}><Badge tone="yellow">{block.block_type === "quiz" ? "Quiz" : "Atividade"}</Badge>{block.title && <h3>{block.title}</h3>}{block.body && <p>{block.body}</p>}{enrollment && block.linked_mission_id ? <Link className="button button-primary button-small" href={`/aluno/missoes/${block.linked_mission_id}`}>Abrir {block.block_type === "quiz" ? "quiz" : "atividade"}</Link> : <small className="muted">Comece a trilha para liberar esta atividade.</small>}</section>;
            return <section className="student-course-block" key={block.id}>{block.title && <h3>{block.title}</h3>}{block.body && <p>{block.body}</p>}<div className="flex gap-8 wrap">{block.external_url ? <a className="button button-secondary button-small" href={block.external_url} target="_blank" rel="noreferrer">{blockButtonLabel(block)}</a> : null}{fileUrl ? <a className="button button-secondary button-small" href={fileUrl} target="_blank" rel="noreferrer">Abrir arquivo</a> : null}</div></section>;
          })}</div> : null}

          {enrollment && !complete ? <form action={completeStudentCourseModule} className="mt-16"><input type="hidden" name="moduleId" value={module.id} /><input type="hidden" name="slug" value={course.slug} /><button className="button button-primary button-small" type="submit">Concluir esta etapa</button></form> : null}
        </div>
      </article>;
    })}</div>

    {enrollment?.status === "completed" && course.certificate_enabled ? <section className="panel student-certificate-card"><div className="student-certificate-copy"><span className="student-certificate-icon"><CurioIcon name="trophy" /></span><div><span className="student-kicker">Conquista especial</span><h2>Seu certificado está registrado</h2><p>Código: <strong>{certificate?.certificate_code || "em preparação"}</strong></p></div></div><div className="flex gap-8 wrap">{certificate ? <Link className="button button-primary" href={`/aluno/cursos/${course.id}/certificado`}>Abrir certificado</Link> : null}{certificateUrl ? <a className="button button-secondary" href={certificateUrl} target="_blank" rel="noreferrer">Abrir arquivo emitido</a> : null}</div></section> : null}
    <p><Link href="/aluno/modo-pensar">← Voltar ao Modo Pensar</Link></p>
  </>;
}
