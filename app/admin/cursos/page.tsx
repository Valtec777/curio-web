import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createFreeCourse, removeFreeCourseModule, removeOrArchiveFreeCourse, saveFreeCourseModule, setFreeCourseStatus, updateFreeCourse } from "@/app/admin/actions";

function statusTone(status: string): "green" | "yellow" | "neutral" {
  if (status === "published") return "green";
  if (status === "draft") return "yellow";
  return "neutral";
}

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: courses }, { data: modules }, { count: enrollments }, { count: certificates }] = await Promise.all([
    supabase.from("free_courses").select("id,title,slug,summary,description,audience_label,estimated_minutes,certificate_enabled,status,published_at,created_at").order("created_at", { ascending: false }),
    supabase.from("free_course_modules").select("id,course_id,title,description,body,resource_type,external_url,file_path,position,duration_minutes,required").order("position"),
    supabase.from("free_course_enrollments").select("id", { count: "exact", head: true }),
    supabase.from("free_course_certificates").select("id", { count: "exact", head: true }),
  ]);
  const modulesByCourse = new Map<string, any[]>();
  for (const module of modules ?? []) modulesByCourse.set(module.course_id, [...(modulesByCourse.get(module.course_id) || []), module]);

  return (
    <>
      <PageHeader eyebrow="Admin • Pedagógico" title="Cursos Livres · Modo Pensar" description="Crie trilhas extras para os alunos. Cursos publicados aparecem no Modo Pensar e podem liberar certificado ao final." />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="stats-grid">
        <StatCard value={(courses ?? []).filter((c: any) => c.status === "published").length} label="Cursos publicados" />
        <StatCard value={(courses ?? []).filter((c: any) => c.status === "draft").length} label="Rascunhos" />
        <StatCard value={enrollments ?? 0} label="Inícios de curso" />
        <StatCard value={certificates ?? 0} label="Certificados emitidos" />
      </div>

      <section className="panel course-admin-create">
        <div className="panel-head"><div><h2>Novo curso livre</h2><p>Comece pelo curso, depois adicione as etapas. Nada aparece para o aluno enquanto estiver em rascunho.</p></div></div>
        <form action={createFreeCourse} className="form-stack">
          <div className="form-row"><div className="field"><label>Título *</label><input className="input" name="title" required /></div><div className="field"><label>Slug opcional</label><input className="input" name="slug" placeholder="ex.: organizacao-dos-estudos" /></div></div>
          <div className="field"><label>Resumo</label><input className="input" name="summary" maxLength={300} placeholder="Uma frase curta para o card do aluno" /></div>
          <div className="field"><label>Descrição</label><textarea className="textarea" name="description" /></div>
          <div className="form-row"><div className="field"><label>Público</label><input className="input" name="audienceLabel" defaultValue="Crianças e adolescentes" /></div><div className="field"><label>Carga estimada (minutos)</label><input className="input" type="number" name="estimatedMinutes" min="1" defaultValue="60" required /></div></div>
          <label className="consent-line"><input type="checkbox" name="certificateEnabled" defaultChecked /> Emitir certificado quando as etapas obrigatórias forem concluídas</label>
          <button className="button button-primary" type="submit">Criar curso como rascunho</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Catálogo de cursos</h2><p>Edite, organize as etapas e publique quando estiver pronto.</p></div></div>
        {courses?.length ? <div className="course-admin-list">{courses.map((course: any) => {
          const courseModules = modulesByCourse.get(course.id) || [];
          return <article className="course-admin-card" key={course.id}>
            <div className="course-admin-summary">
              <div><div className="flex gap-8 wrap"><Badge tone={statusTone(course.status)}>{course.status === "published" ? "Publicado" : course.status === "draft" ? "Rascunho" : "Arquivado"}</Badge>{course.certificate_enabled && <Badge tone="purple">Certificado</Badge>}</div><h3>{course.title}</h3><p>{course.summary || course.description || "Sem resumo"}</p><small className="muted">{courseModules.length} etapa(s) · {course.estimated_minutes} min · /{course.slug}</small></div>
              <div className="course-admin-actions">
                <form action={setFreeCourseStatus}><input type="hidden" name="courseId" value={course.id} /><input type="hidden" name="status" value={course.status === "published" ? "draft" : "published"} /><button className={`button button-small ${course.status === "published" ? "button-secondary" : "button-primary"}`} type="submit">{course.status === "published" ? "Voltar a rascunho" : "Publicar"}</button></form>
                <form action={removeOrArchiveFreeCourse}><input type="hidden" name="courseId" value={course.id} /><button className="button button-danger button-small" type="submit">{course.status === "draft" ? "Excluir/arquivar" : "Arquivar"}</button></form>
              </div>
            </div>

            <details className="plan-editor"><summary>Editar curso</summary><form action={updateFreeCourse} className="form-stack plan-form"><input type="hidden" name="courseId" value={course.id} /><div className="form-row"><div className="field"><label>Título</label><input className="input" name="title" defaultValue={course.title} required /></div><div className="field"><label>Slug</label><input className="input" name="slug" defaultValue={course.slug} /></div></div><div className="field"><label>Resumo</label><input className="input" name="summary" defaultValue={course.summary || ""} /></div><div className="field"><label>Descrição</label><textarea className="textarea" name="description" defaultValue={course.description || ""} /></div><div className="form-row"><div className="field"><label>Público</label><input className="input" name="audienceLabel" defaultValue={course.audience_label || ""} /></div><div className="field"><label>Carga (min)</label><input className="input" type="number" name="estimatedMinutes" min="1" defaultValue={course.estimated_minutes} /></div></div><label className="consent-line"><input type="checkbox" name="certificateEnabled" defaultChecked={course.certificate_enabled} /> Certificado</label><button className="button button-secondary" type="submit">Salvar curso</button></form></details>

            <div className="course-admin-modules">
              <h4>Etapas</h4>
              {courseModules.length ? <div className="form-stack">{courseModules.map((module: any) => <details className="course-module-admin" key={module.id}><summary><span>{module.position}. {module.title}</span><Badge tone={module.required ? "blue" : "neutral"}>{module.required ? "Obrigatória" : "Opcional"}</Badge></summary><form action={saveFreeCourseModule} className="form-stack"><input type="hidden" name="moduleId" value={module.id} /><input type="hidden" name="courseId" value={course.id} /><div className="form-row"><div className="field"><label>Título</label><input className="input" name="title" defaultValue={module.title} required /></div><div className="field"><label>Posição</label><input className="input" type="number" name="position" defaultValue={module.position} required /></div></div><div className="field"><label>Descrição</label><input className="input" name="description" defaultValue={module.description || ""} /></div><div className="field"><label>Conteúdo da etapa</label><textarea className="textarea" name="body" defaultValue={module.body || ""} /></div><div className="form-row"><div className="field"><label>Tipo</label><select className="select" name="resourceType" defaultValue={module.resource_type}><option value="lesson">Aula/texto</option><option value="video">Vídeo</option><option value="link">Link</option><option value="download">Download</option><option value="practice">Prática</option></select></div><div className="field"><label>Duração (min)</label><input className="input" type="number" name="durationMinutes" defaultValue={module.duration_minutes} required /></div></div><div className="form-row"><div className="field"><label>URL externa</label><input className="input" name="externalUrl" defaultValue={module.external_url || ""} /></div><div className="field"><label>Caminho de arquivo</label><input className="input" name="filePath" defaultValue={module.file_path || ""} /></div></div><label className="consent-line"><input type="checkbox" name="required" defaultChecked={module.required} /> Etapa obrigatória</label><div className="flex gap-8 wrap"><button className="button button-secondary button-small" type="submit">Salvar etapa</button></div></form><form action={removeFreeCourseModule}><input type="hidden" name="moduleId" value={module.id} /><button className="button button-danger button-small" type="submit">Excluir etapa sem histórico</button></form></details>)}</div> : <p className="muted">Nenhuma etapa ainda.</p>}

              <details className="course-add-module"><summary>+ Adicionar etapa</summary><form action={saveFreeCourseModule} className="form-stack"><input type="hidden" name="courseId" value={course.id} /><div className="form-row"><div className="field"><label>Título *</label><input className="input" name="title" required /></div><div className="field"><label>Posição *</label><input className="input" type="number" name="position" min="1" defaultValue={courseModules.length + 1} required /></div></div><div className="field"><label>Descrição</label><input className="input" name="description" /></div><div className="field"><label>Conteúdo</label><textarea className="textarea" name="body" /></div><div className="form-row"><div className="field"><label>Tipo</label><select className="select" name="resourceType" defaultValue="lesson"><option value="lesson">Aula/texto</option><option value="video">Vídeo</option><option value="link">Link</option><option value="download">Download</option><option value="practice">Prática</option></select></div><div className="field"><label>Duração (min)</label><input className="input" type="number" name="durationMinutes" min="1" defaultValue="10" required /></div></div><div className="form-row"><div className="field"><label>URL externa</label><input className="input" name="externalUrl" /></div><div className="field"><label>Caminho do arquivo</label><input className="input" name="filePath" /></div></div><label className="consent-line"><input type="checkbox" name="required" defaultChecked /> Obrigatória para concluir o curso</label><button className="button button-primary button-small" type="submit">Adicionar etapa</button></form></details>
            </div>
          </article>;
        })}</div> : <EmptyState title="Nenhum curso criado" description="Crie o primeiro curso livre usando o formulário acima." />}
      </section>
    </>
  );
}
