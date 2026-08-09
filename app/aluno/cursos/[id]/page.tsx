import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { getCurrentStudent } from "@/lib/student";
import { completeFreeCourseModule, startFreeCourse } from "../actions";

export default async function StudentCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { student, supabase } = await getCurrentStudent();

  const [{ data: course }, { data: modules }, { data: enrollment }] = await Promise.all([
    supabase.from("free_courses").select("id,title,summary,description,audience_label,estimated_minutes,certificate_enabled,status").eq("id", id).eq("status", "published").maybeSingle(),
    supabase.from("free_course_modules").select("id,title,description,body,resource_type,external_url,file_path,position,duration_minutes,required").eq("course_id", id).order("position"),
    supabase.from("free_course_enrollments").select("id,status,progress_percent,started_at,completed_at").eq("course_id", id).eq("student_id", student.id).maybeSingle(),
  ]);

  if (!course) notFound();

  const [{ data: progress }, { data: certificate }] = enrollment ? await Promise.all([
    supabase.from("free_course_module_progress").select("module_id,completed_at").eq("enrollment_id", enrollment.id),
    supabase.from("free_course_certificates").select("id,certificate_code,issued_at").eq("enrollment_id", enrollment.id).maybeSingle(),
  ]) : [{ data: [] as any[] }, { data: null as any }];

  const completedIds = new Set((progress ?? []).map((item: any) => item.module_id));

  return (
    <>
      <PageHeader
        eyebrow="Modo Pensar · Curso Livre"
        title={course.title}
        description={course.summary || "Curso livre do Curió para ampliar repertório e autonomia."}
        action={<Link className="button button-secondary button-small" href="/aluno/modo-pensar">← Todos os cursos</Link>}
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="stats-grid course-stats">
        <StatCard value={`${course.estimated_minutes} min`} label="Carga estimada" />
        <StatCard value={`${enrollment?.progress_percent ?? 0}%`} label="Progresso" />
        <StatCard value={(modules ?? []).length} label="Etapas" />
        <StatCard value={course.certificate_enabled ? "Sim" : "Não"} label="Certificado" />
      </div>

      {!enrollment ? (
        <section className="panel course-start-panel">
          <div>
            <div className="eyebrow eyebrow-green">Curso livre Curió</div>
            <h2>Pronto para começar?</h2>
            <p>{course.description || "Avance pelas etapas no seu ritmo. Ao concluir as etapas obrigatórias, o certificado é liberado automaticamente."}</p>
          </div>
          <form action={startFreeCourse}>
            <input type="hidden" name="courseId" value={course.id} />
            <button className="button button-primary" type="submit">Começar curso</button>
          </form>
        </section>
      ) : (
        <section className="panel course-progress-panel">
          <div className="flex space-between gap-8 wrap">
            <div><strong>Seu progresso</strong><p>{enrollment.status === "completed" ? "Curso concluído. Parabéns!" : "Conclua as etapas abaixo no seu ritmo."}</p></div>
            <Badge tone={enrollment.status === "completed" ? "green" : "blue"}>{enrollment.progress_percent}%</Badge>
          </div>
          <div className="progress"><span style={{ width: `${enrollment.progress_percent}%` }} /></div>
          {certificate && (
            <div className="certificate-ready">
              <div><strong>Certificado liberado</strong><p>Documento com código de validação {certificate.certificate_code}.</p></div>
              <Link className="button button-primary button-small" href={`/aluno/cursos/${course.id}/certificado`}>Abrir certificado</Link>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><div><h2>Etapas do curso</h2><p>Conteúdo livre criado e publicado pela Administração do Curió.</p></div></div>
        {modules?.length ? (
          <div className="course-module-list">
            {modules.map((module: any) => {
              const done = completedIds.has(module.id);
              return (
                <article className={`course-module-card${done ? " is-complete" : ""}`} key={module.id}>
                  <div className="course-module-number">{module.position}</div>
                  <div className="course-module-content">
                    <div className="flex gap-8 wrap">
                      <Badge tone={done ? "green" : "blue"}>{done ? "Concluída" : module.resource_type}</Badge>
                      <Badge tone="neutral">{module.duration_minutes} min</Badge>
                      {!module.required && <Badge tone="purple">Opcional</Badge>}
                    </div>
                    <h3>{module.title}</h3>
                    {module.description && <p>{module.description}</p>}
                    {module.body && <div className="course-module-body">{module.body}</div>}
                    {(module.external_url || module.file_path) && (
                      <a className="button button-secondary button-small" href={module.external_url || module.file_path} target="_blank" rel="noreferrer">Abrir material externo ↗</a>
                    )}
                  </div>
                  <div className="course-module-action">
                    {done ? (
                      <span className="course-done-mark" aria-label="Concluída">✓</span>
                    ) : enrollment ? (
                      <form action={completeFreeCourseModule}>
                        <input type="hidden" name="courseId" value={course.id} />
                        <input type="hidden" name="moduleId" value={module.id} />
                        <button className="button button-primary button-small" type="submit">Concluir etapa</button>
                      </form>
                    ) : (
                      <span className="muted text-small">Inicie o curso primeiro</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Curso em preparação" description="A Administração publicou o curso, mas ainda não adicionou etapas." />}
      </section>
    </>
  );
}
