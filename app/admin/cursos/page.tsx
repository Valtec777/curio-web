import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addCourseFilesAsModules,
  createModoPensarCourse,
  duplicateModoPensarModule,
  moveModoPensarModule,
  removeModoPensarBlock,
  removeModoPensarModule,
  removeOrArchiveModoPensarCourse,
  saveModoPensarBlock,
  saveModoPensarModule,
  setModoPensarBlockStatus,
  setModoPensarCourseStatus,
  setModoPensarModuleStatus,
  updateModoPensarCourse,
} from "./actions";

const statusCopy: Record<string, { label: string; tone: "green" | "yellow" | "neutral" | "blue" }> = {
  published: { label: "Publicado", tone: "green" },
  draft: { label: "Rascunho", tone: "yellow" },
  hidden: { label: "Oculto", tone: "blue" },
  archived: { label: "Arquivado", tone: "neutral" },
};

function statusBadge(status: string) {
  const value = statusCopy[status] || statusCopy.draft;
  return <Badge tone={value.tone}>{value.label}</Badge>;
}

function cleanConfig(value: any) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function blockLabel(type: string) {
  const labels: Record<string, string> = {
    text: "Texto",
    image: "Imagem",
    video: "Vídeo",
    link: "Link",
    download: "Arquivo",
    quiz: "Quiz / Missão",
    activity: "Atividade / Missão",
    button: "Botão",
  };
  return labels[type] || type;
}

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const [
    { data: courses },
    { data: modules },
    { data: blocks },
    { data: characters },
    { data: missions },
    { count: enrollments },
    { count: certificates },
  ] = await Promise.all([
    supabase.from("free_courses").select("id,title,slug,summary,description,cover_image_path,category,audience_label,age_label,level_label,objective,character_id,estimated_minutes,sort_order,certificate_enabled,certificate_config,status,published_at,created_at").order("sort_order").order("created_at", { ascending: false }),
    supabase.from("free_course_modules").select("id,course_id,title,description,body,resource_type,external_url,file_path,position,duration_minutes,required,status").order("position"),
    supabase.from("free_course_module_blocks").select("id,module_id,block_type,title,body,external_url,file_path,linked_mission_id,position,status,config").order("position"),
    supabase.from("characters").select("id,name").eq("active", true).order("name"),
    supabase.from("missions").select("id,title,status").neq("status", "archived").order("updated_at", { ascending: false }).limit(100),
    supabase.from("free_course_enrollments").select("id", { count: "exact", head: true }),
    supabase.from("free_course_certificates").select("id", { count: "exact", head: true }),
  ]);

  const modulesByCourse = new Map<string, any[]>();
  for (const item of modules ?? []) modulesByCourse.set(item.course_id, [...(modulesByCourse.get(item.course_id) || []), item]);
  const blocksByModule = new Map<string, any[]>();
  for (const block of blocks ?? []) blocksByModule.set(block.module_id, [...(blocksByModule.get(block.module_id) || []), block]);

  const signedUrls = new Map<string, string>();
  const paths = new Set<string>();
  for (const course of courses ?? []) if (course.cover_image_path) paths.add(course.cover_image_path);
  for (const module of modules ?? []) if (module.file_path) paths.add(module.file_path);
  for (const block of blocks ?? []) if (block.file_path) paths.add(block.file_path);
  for (const path of paths) {
    const { data } = await supabase.storage.from("generated-documents").createSignedUrl(path, 60 * 20);
    if (data?.signedUrl) signedUrls.set(path, data.signedUrl);
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin • Pedagógico"
        title="Modo Pensar"
        description="Construa trilhas por etapas. Comece simples com PDFs e depois acrescente texto, vídeo, Missão/Quiz, atividade e materiais sem recriar o curso."
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="stats-grid">
        <StatCard value={(courses ?? []).filter((c: any) => c.status === "published").length} label="Trilhas publicadas" />
        <StatCard value={(courses ?? []).filter((c: any) => c.status === "draft").length} label="Rascunhos" />
        <StatCard value={enrollments ?? 0} label="Trilhas iniciadas" />
        <StatCard value={certificates ?? 0} label="Certificados emitidos" />
      </div>

      <section className="panel">
        <div className="panel-head"><div><h2>Nova trilha</h2><p>Ela nasce como rascunho. Nada chega ao aluno antes de você publicar etapas e depois publicar a trilha.</p></div></div>
        <form action={createModoPensarCourse} className="form-stack">
          <div className="form-row">
            <div className="field"><label>Nome *</label><input className="input" name="title" required /></div>
            <div className="field"><label>Endereço curto</label><input className="input" name="slug" placeholder="ex.: comunicacao-e-oratoria" /></div>
          </div>
          <div className="field"><label>Resumo</label><input className="input" name="summary" maxLength={300} /></div>
          <div className="field"><label>Descrição</label><textarea className="textarea" name="description" /></div>
          <div className="form-row">
            <div className="field"><label>Categoria</label><input className="input" name="category" placeholder="Comunicação, estudos, criatividade..." /></div>
            <div className="field"><label>Público</label><input className="input" name="audienceLabel" defaultValue="Crianças e adolescentes" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Idade indicada</label><input className="input" name="ageLabel" placeholder="Ex.: 11 a 15 anos" /></div>
            <div className="field"><label>Nível</label><input className="input" name="levelLabel" placeholder="Iniciante, intermediário..." /></div>
          </div>
          <div className="field"><label>Objetivo</label><textarea className="textarea" name="objective" placeholder="O que o aluno deverá desenvolver ao longo da trilha?" /></div>
          <div className="form-row">
            <div className="field"><label>Personagem</label><select className="select" name="characterId" defaultValue=""><option value="">Sem personagem definido</option>{characters?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="field"><label>Carga estimada (min)</label><input className="input" type="number" name="estimatedMinutes" min="1" defaultValue="60" required /></div>
            <div className="field"><label>Ordem</label><input className="input" type="number" name="sortOrder" min="0" defaultValue="0" /></div>
          </div>
          <div className="field"><label>Capa <span className="field-optional">opcional</span></label><input className="input" type="file" name="cover" accept="image/png,image/jpeg,image/webp" /></div>
          <details className="plan-editor"><summary>Configurar certificado</summary><div className="form-stack plan-form"><label className="consent-line"><input type="checkbox" name="certificateEnabled" defaultChecked /> Emitir certificado quando os requisitos forem cumpridos</label><div className="form-row"><div className="field"><label>Título do certificado</label><input className="input" name="certificateTitle" defaultValue="Certificado de conclusão" /></div><div className="field"><label>Responsável / assinatura</label><input className="input" name="signatoryName" /></div></div><div className="field"><label>Função do responsável</label><input className="input" name="signatoryRole" /></div></div></details>
          <button className="button button-primary" type="submit">Criar trilha como rascunho</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Trilhas cadastradas</h2><p>Publicar não trava a edição. Mudanças futuras preservam o progresso sempre que possível.</p></div></div>
        {courses?.length ? <div className="course-admin-list">
          {courses.map((course: any) => {
            const courseModules = modulesByCourse.get(course.id) || [];
            const cert = cleanConfig(course.certificate_config);
            return <article className="course-admin-card" key={course.id}>
              <div className="course-admin-summary">
                <div>
                  <div className="flex gap-8 wrap">{statusBadge(course.status)}{course.certificate_enabled && <Badge tone="purple">Certificado</Badge>}{course.category && <Badge tone="blue">{course.category}</Badge>}</div>
                  <h3>{course.title}</h3><p>{course.summary || course.description || "Sem resumo"}</p>
                  <small className="muted">{courseModules.length} etapa(s) · {course.estimated_minutes} min · /{course.slug}</small>
                  {course.cover_image_path && signedUrls.get(course.cover_image_path) ? <p><a href={signedUrls.get(course.cover_image_path)} target="_blank" rel="noreferrer">Abrir capa atual ↗</a></p> : null}
                </div>
                <div className="course-admin-actions">
                  {course.status !== "published" && <form action={setModoPensarCourseStatus}><input type="hidden" name="courseId" value={course.id}/><input type="hidden" name="status" value="published"/><button className="button button-primary button-small" type="submit">Publicar trilha</button></form>}
                  {course.status === "published" && <form action={setModoPensarCourseStatus}><input type="hidden" name="courseId" value={course.id}/><input type="hidden" name="status" value="hidden"/><button className="button button-secondary button-small" type="submit">Ocultar dos alunos</button></form>}
                  {course.status === "hidden" && <form action={setModoPensarCourseStatus}><input type="hidden" name="courseId" value={course.id}/><input type="hidden" name="status" value="draft"/><button className="button button-secondary button-small" type="submit">Voltar a rascunho</button></form>}
                  <form action={removeOrArchiveModoPensarCourse}><input type="hidden" name="courseId" value={course.id}/><button className="button button-danger button-small" type="submit">{course.status === "draft" ? "Excluir/arquivar" : "Arquivar"}</button></form>
                </div>
              </div>

              <details className="plan-editor">
                <summary>Editar informações, capa e certificado</summary>
                <form action={updateModoPensarCourse} className="form-stack plan-form">
                  <input type="hidden" name="courseId" value={course.id}/>
                  <div className="form-row"><div className="field"><label>Nome</label><input className="input" name="title" defaultValue={course.title} required /></div><div className="field"><label>Endereço curto</label><input className="input" name="slug" defaultValue={course.slug}/></div></div>
                  <div className="field"><label>Resumo</label><input className="input" name="summary" defaultValue={course.summary || ""}/></div>
                  <div className="field"><label>Descrição</label><textarea className="textarea" name="description" defaultValue={course.description || ""}/></div>
                  <div className="form-row"><div className="field"><label>Categoria</label><input className="input" name="category" defaultValue={course.category || ""}/></div><div className="field"><label>Público</label><input className="input" name="audienceLabel" defaultValue={course.audience_label || ""}/></div></div>
                  <div className="form-row"><div className="field"><label>Idade indicada</label><input className="input" name="ageLabel" defaultValue={course.age_label || ""}/></div><div className="field"><label>Nível</label><input className="input" name="levelLabel" defaultValue={course.level_label || ""}/></div></div>
                  <div className="field"><label>Objetivo</label><textarea className="textarea" name="objective" defaultValue={course.objective || ""}/></div>
                  <div className="form-row"><div className="field"><label>Personagem</label><select className="select" name="characterId" defaultValue={course.character_id || ""}><option value="">Sem personagem</option>{characters?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="field"><label>Carga (min)</label><input className="input" type="number" name="estimatedMinutes" min="1" defaultValue={course.estimated_minutes}/></div><div className="field"><label>Ordem</label><input className="input" type="number" min="0" name="sortOrder" defaultValue={course.sort_order || 0}/></div></div>
                  <div className="field"><label>Substituir capa</label><input className="input" type="file" name="cover" accept="image/png,image/jpeg,image/webp" /></div>
                  <label className="consent-line"><input type="checkbox" name="certificateEnabled" defaultChecked={course.certificate_enabled}/> Emitir certificado</label>
                  <div className="form-row"><div className="field"><label>Título do certificado</label><input className="input" name="certificateTitle" defaultValue={cert.title || "Certificado de conclusão"}/></div><div className="field"><label>Responsável / assinatura</label><input className="input" name="signatoryName" defaultValue={cert.signatory_name || ""}/></div></div>
                  <div className="field"><label>Função do responsável</label><input className="input" name="signatoryRole" defaultValue={cert.signatory_role || ""}/></div>
                  <button className="button button-secondary" type="submit">Salvar trilha</button>
                </form>
              </details>

              <details className="plan-editor">
                <summary>Começar por arquivos — criar várias etapas de uma vez</summary>
                <form action={addCourseFilesAsModules} className="form-stack plan-form">
                  <input type="hidden" name="courseId" value={course.id}/>
                  <div className="field"><label>PDF, DOCX ou PPTX <span className="field-optional">até 20 arquivos · 15 MB cada</span></label><input className="input" type="file" name="files" accept="application/pdf,.pdf,.docx,.pptx" multiple required /></div>
                  <p className="muted">Cada arquivo vira uma etapa em rascunho. Depois você pode abrir a etapa e acrescentar texto, vídeo, quiz, atividade ou outros materiais.</p>
                  <button className="button button-primary button-small" type="submit">Criar etapas a partir dos arquivos</button>
                </form>
              </details>

              <div className="course-admin-modules">
                <h4>Etapas da trilha</h4>
                {courseModules.length ? <div className="form-stack">{courseModules.map((module: any) => {
                  const moduleBlocks = blocksByModule.get(module.id) || [];
                  return <details className="course-module-admin" key={module.id}>
                    <summary><span>{module.position}. {module.title}</span><span className="flex gap-8 wrap">{statusBadge(module.status)}<Badge tone={module.required ? "blue" : "neutral"}>{module.required ? "Obrigatória" : "Opcional"}</Badge><Badge tone="neutral">{moduleBlocks.length} bloco(s)</Badge></span></summary>
                    <div className="flex gap-8 wrap mb-16">
                      <form action={moveModoPensarModule}><input type="hidden" name="moduleId" value={module.id}/><input type="hidden" name="direction" value="up"/><button className="button button-ghost button-small" type="submit">Mover para cima</button></form>
                      <form action={moveModoPensarModule}><input type="hidden" name="moduleId" value={module.id}/><input type="hidden" name="direction" value="down"/><button className="button button-ghost button-small" type="submit">Mover para baixo</button></form>
                      <form action={duplicateModoPensarModule}><input type="hidden" name="moduleId" value={module.id}/><button className="button button-secondary button-small" type="submit">Duplicar</button></form>
                      {module.status !== "published" && <form action={setModoPensarModuleStatus}><input type="hidden" name="moduleId" value={module.id}/><input type="hidden" name="status" value="published"/><button className="button button-primary button-small" type="submit">Publicar etapa</button></form>}
                      {module.status === "published" && <form action={setModoPensarModuleStatus}><input type="hidden" name="moduleId" value={module.id}/><input type="hidden" name="status" value="hidden"/><button className="button button-secondary button-small" type="submit">Ocultar etapa</button></form>}
                    </div>
                    <form action={saveModoPensarModule} className="form-stack">
                      <input type="hidden" name="moduleId" value={module.id}/><input type="hidden" name="courseId" value={course.id}/><input type="hidden" name="existingFilePath" value={module.file_path || ""}/>
                      <div className="form-row"><div className="field"><label>Título</label><input className="input" name="title" defaultValue={module.title} required /></div><div className="field"><label>Posição</label><input className="input" type="number" name="position" min="1" defaultValue={module.position} required /></div></div>
                      <div className="field"><label>Descrição</label><input className="input" name="description" defaultValue={module.description || ""}/></div>
                      <div className="field"><label>Texto principal da etapa</label><textarea className="textarea" name="body" defaultValue={module.body || ""}/></div>
                      <div className="form-row"><div className="field"><label>Formato principal</label><select className="select" name="resourceType" defaultValue={module.resource_type}><option value="lesson">Aula / texto</option><option value="video">Vídeo</option><option value="link">Link</option><option value="download">Arquivo</option><option value="practice">Prática</option></select></div><div className="field"><label>Duração (min)</label><input className="input" type="number" name="durationMinutes" min="1" defaultValue={module.duration_minutes} required /></div><div className="field"><label>Situação</label><select className="select" name="status" defaultValue={module.status}><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="hidden">Oculto</option><option value="archived">Arquivado</option></select></div></div>
                      <div className="field"><label>Link HTTPS</label><input className="input" type="url" name="externalUrl" defaultValue={module.external_url || ""}/></div>
                      <div className="field"><label>Arquivo principal</label><input className="input" type="file" name="file" accept="application/pdf,.pdf,.docx,.pptx,text/plain,image/png,image/jpeg,image/webp"/>{module.file_path && signedUrls.get(module.file_path) ? <small><a href={signedUrls.get(module.file_path)} target="_blank" rel="noreferrer">Abrir arquivo atual ↗</a></small> : null}</div>
                      <label className="consent-line"><input type="checkbox" name="required" defaultChecked={module.required}/> Obrigatória para concluir a trilha</label>
                      <button className="button button-secondary button-small" type="submit">Salvar etapa</button>
                    </form>

                    <div className="panel mt-16">
                      <div className="panel-head"><div><h4>Blocos desta etapa</h4><p>Combine vários elementos na mesma etapa. Quiz e atividade reutilizam uma Missão existente em vez de criar outro sistema de perguntas.</p></div></div>
                      {moduleBlocks.length ? <div className="form-stack">{moduleBlocks.map((block: any) => {
                        const cfg = cleanConfig(block.config);
                        return <details className="plan-editor" key={block.id}><summary>{block.position}. {block.title || blockLabel(block.block_type)} · {statusCopy[block.status]?.label || block.status}</summary>
                          <form action={saveModoPensarBlock} className="form-stack plan-form">
                            <input type="hidden" name="blockId" value={block.id}/><input type="hidden" name="moduleId" value={module.id}/><input type="hidden" name="existingFilePath" value={block.file_path || ""}/>
                            <div className="form-row"><div className="field"><label>Tipo</label><select className="select" name="blockType" defaultValue={block.block_type}><option value="text">Texto</option><option value="image">Imagem</option><option value="video">Vídeo</option><option value="link">Link</option><option value="download">Arquivo</option><option value="quiz">Quiz / Missão</option><option value="activity">Atividade / Missão</option><option value="button">Botão</option></select></div><div className="field"><label>Posição</label><input className="input" type="number" name="position" min="1" defaultValue={block.position}/></div><div className="field"><label>Situação</label><select className="select" name="status" defaultValue={block.status}><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="hidden">Oculto</option><option value="archived">Arquivado</option></select></div></div>
                            <div className="field"><label>Título</label><input className="input" name="title" defaultValue={block.title || ""}/></div><div className="field"><label>Texto / instrução</label><textarea className="textarea" name="body" defaultValue={block.body || ""}/></div>
                            <div className="field"><label>Link HTTPS</label><input className="input" type="url" name="externalUrl" defaultValue={block.external_url || ""}/></div>
                            <div className="field"><label>Missão/Quiz existente</label><select className="select" name="linkedMissionId" defaultValue={block.linked_mission_id || ""}><option value="">Nenhuma</option>{missions?.map((m: any) => <option value={m.id} key={m.id}>{m.title} · {m.status}</option>)}</select></div>
                            <div className="field"><label>Texto do botão</label><input className="input" name="buttonLabel" defaultValue={cfg.button_label || ""}/></div>
                            <div className="field"><label>Arquivo</label><input className="input" type="file" name="file" accept="application/pdf,.pdf,.docx,.pptx,text/plain,image/png,image/jpeg,image/webp"/>{block.file_path && signedUrls.get(block.file_path) ? <small><a href={signedUrls.get(block.file_path)} target="_blank" rel="noreferrer">Abrir arquivo atual ↗</a></small> : null}</div>
                            <button className="button button-secondary button-small" type="submit">Salvar bloco</button>
                          </form>
                          <div className="flex gap-8 wrap"><form action={setModoPensarBlockStatus}><input type="hidden" name="blockId" value={block.id}/><input type="hidden" name="status" value={block.status === "published" ? "hidden" : "published"}/><button className="button button-ghost button-small" type="submit">{block.status === "published" ? "Ocultar bloco" : "Publicar bloco"}</button></form><form action={removeModoPensarBlock}><input type="hidden" name="blockId" value={block.id}/><button className="button button-danger button-small" type="submit">Excluir bloco</button></form></div>
                        </details>;
                      })}</div> : <p className="muted">Nenhum bloco extra. O texto/arquivo principal da etapa continua funcionando normalmente.</p>}

                      <details className="course-add-module"><summary>Adicionar bloco</summary><form action={saveModoPensarBlock} className="form-stack plan-form"><input type="hidden" name="moduleId" value={module.id}/><div className="form-row"><div className="field"><label>Tipo</label><select className="select" name="blockType" defaultValue="text"><option value="text">Texto</option><option value="image">Imagem</option><option value="video">Vídeo</option><option value="link">Link</option><option value="download">Arquivo</option><option value="quiz">Quiz / Missão</option><option value="activity">Atividade / Missão</option><option value="button">Botão</option></select></div><div className="field"><label>Posição</label><input className="input" type="number" name="position" min="1" defaultValue={moduleBlocks.length + 1}/></div><div className="field"><label>Situação</label><select className="select" name="status" defaultValue="draft"><option value="draft">Rascunho</option><option value="published">Publicado</option></select></div></div><div className="field"><label>Título</label><input className="input" name="title"/></div><div className="field"><label>Texto / instrução</label><textarea className="textarea" name="body"/></div><div className="field"><label>Link HTTPS</label><input className="input" type="url" name="externalUrl"/></div><div className="field"><label>Missão/Quiz existente</label><select className="select" name="linkedMissionId" defaultValue=""><option value="">Nenhuma</option>{missions?.map((m: any) => <option value={m.id} key={m.id}>{m.title} · {m.status}</option>)}</select></div><div className="field"><label>Texto do botão</label><input className="input" name="buttonLabel"/></div><div className="field"><label>Arquivo</label><input className="input" type="file" name="file" accept="application/pdf,.pdf,.docx,.pptx,text/plain,image/png,image/jpeg,image/webp"/></div><button className="button button-primary button-small" type="submit">Adicionar bloco em rascunho</button></form></details>
                    </div>

                    <form action={removeModoPensarModule} className="mt-16"><input type="hidden" name="moduleId" value={module.id}/><input type="hidden" name="courseId" value={course.id}/><button className="button button-danger button-small" type="submit">Excluir etapa sem progresso</button></form>
                  </details>;
                })}</div> : <p className="muted">Nenhuma etapa ainda.</p>}

                <details className="course-add-module"><summary>Adicionar etapa manualmente</summary><form action={saveModoPensarModule} className="form-stack plan-form"><input type="hidden" name="courseId" value={course.id}/><div className="form-row"><div className="field"><label>Título *</label><input className="input" name="title" required/></div><div className="field"><label>Posição *</label><input className="input" type="number" name="position" min="1" defaultValue={courseModules.length + 1} required/></div></div><div className="field"><label>Descrição</label><input className="input" name="description"/></div><div className="field"><label>Texto principal</label><textarea className="textarea" name="body"/></div><div className="form-row"><div className="field"><label>Formato</label><select className="select" name="resourceType" defaultValue="lesson"><option value="lesson">Aula / texto</option><option value="video">Vídeo</option><option value="link">Link</option><option value="download">Arquivo</option><option value="practice">Prática</option></select></div><div className="field"><label>Duração (min)</label><input className="input" type="number" name="durationMinutes" min="1" defaultValue="10" required/></div><div className="field"><label>Situação</label><select className="select" name="status" defaultValue="draft"><option value="draft">Rascunho</option><option value="published">Publicado</option></select></div></div><div className="field"><label>Link HTTPS</label><input className="input" type="url" name="externalUrl"/></div><div className="field"><label>Arquivo</label><input className="input" type="file" name="file" accept="application/pdf,.pdf,.docx,.pptx,text/plain,image/png,image/jpeg,image/webp"/></div><label className="consent-line"><input type="checkbox" name="required" defaultChecked/> Obrigatória para concluir</label><button className="button button-primary button-small" type="submit">Adicionar etapa</button></form></details>
              </div>
            </article>;
          })}
        </div> : <EmptyState title="Nenhuma trilha criada" description="Crie a primeira experiência do Modo Pensar usando o formulário acima." />}
      </section>
    </>
  );
}
