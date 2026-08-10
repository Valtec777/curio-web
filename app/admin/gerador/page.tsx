import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { queueAdminGeneration } from "./actions";

const productLabel: Record<string, string> = {
  mission: "Missão",
  notebook: "Atividade / Caderno",
  material: "Material de apoio / PDF",
  assessment: "Prova / revisão",
  report: "Relatório / documento",
};

const statusLabel: Record<string, string> = {
  queued: "Aguardando processamento",
  running: "Preparando",
  completed: "Pronto para revisar",
  failed: "Precisa de revisão",
  cancelled: "Cancelado",
};

function statusTone(status?: string | null): "green" | "yellow" | "pink" | "neutral" {
  if (status === "completed") return "green";
  if (status === "failed") return "pink";
  if (status === "cancelled") return "neutral";
  return "yellow";
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

export default async function AdminGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();

  const [
    { data: jobs },
    { data: students },
    { data: teachers },
    { data: subjects },
    { data: grades },
  ] = await Promise.all([
    supabase
      .from("generation_jobs")
      .select("id,job_type,status,error_message,created_at,finished_at,input")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("students")
      .select("id,preferred_name,full_name")
      .is("deleted_at", null)
      .in("status", ["active", "paused", "pilot"])
      .order("preferred_name"),
    supabase
      .from("teachers")
      .select("id,profiles(preferred_name,full_name)")
      .eq("active", true)
      .order("created_at"),
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("grades").select("id,name,sort_order").eq("active", true).order("sort_order"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Admin • Pedagógico"
        title="Gerador"
        description="Envie o conteúdo, escolha no que transformar e mantenha o modelo visual separado da fonte. A Missão substitui o antigo conceito de quiz."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="generator-admin-hero">
        <div>
          <Badge tone="yellow">Processamento final em validação</Badge>
          <h2>Fonte → escolha do formato → modelo → material para revisão</h2>
          <p>A entrada e a fila já ficam organizadas aqui. O resultado só será marcado como pronto quando o arquivo ou atividade final realmente for produzido e puder ser revisado.</p>
        </div>
        <div className="generator-product-pills" aria-label="Formatos do gerador">
          <span>Missão</span><span>Caderno</span><span>Material</span><span>Prova</span><span>PDF</span>
        </div>
      </section>

      <form action={queueAdminGeneration} className="generator-admin-form">
        <section className="enrollment-step enrollment-step-lime">
          <div className="enrollment-step-title"><span>1</span><div><h3>O que você quer transformar?</h3><p>Escolha o produto final; não precisa criar um quiz separado.</p></div></div>
          <div className="form-row">
            <div className="field">
              <label>Formato desejado *</label>
              <select className="select" name="outputType" defaultValue="mission" required>
                <option value="mission">Missão — interativa no CURIÓ</option>
                <option value="notebook">Atividade / Caderno CURIÓ</option>
                <option value="material">Material de apoio / PDF</option>
                <option value="assessment">Prova / revisão</option>
                <option value="report">Relatório / documento</option>
              </select>
            </div>
            <div className="field"><label>Título</label><input className="input" name="title" placeholder="Ex.: Revisão de frações" /></div>
          </div>
        </section>

        <section className="enrollment-step enrollment-step-purple">
          <div className="enrollment-step-title"><span>2</span><div><h3>Contexto pedagógico</h3><p>Preencha só o que for útil; o restante pode vir da fonte.</p></div></div>
          <div className="form-row">
            <div className="field"><label>Tema</label><input className="input" name="theme" placeholder="Ex.: Frações equivalentes" /></div>
            <div className="field">
              <label>Matéria</label>
              <select className="select" name="subjectId" defaultValue="">
                <option value="">Escolher depois</option>
                {(subjects ?? []).map((subject: any) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Ano escolar</label>
              <select className="select" name="gradeId" defaultValue="">
                <option value="">Escolher depois</option>
                {(grades ?? []).map((grade: any) => <option value={grade.id} key={grade.id}>{grade.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Professor <span className="field-optional">opcional</span></label>
              <select className="select" name="teacherId" defaultValue="">
                <option value="">Sem professor específico</option>
                {(teachers ?? []).map((teacher: any) => <option value={teacher.id} key={teacher.id}>{teacher.profiles?.preferred_name || teacher.profiles?.full_name || "Professor"}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Aluno <span className="field-optional">opcional</span></label>
            <select className="select" name="studentId" defaultValue="">
              <option value="">Sem aluno específico</option>
              {(students ?? []).map((student: any) => <option value={student.id} key={student.id}>{student.preferred_name || student.full_name}</option>)}
            </select>
            <small className="muted">Se escolher também um professor, o sistema confirma se esse aluno está vinculado a ele.</small>
          </div>
          <div className="field"><label>Objetivo</label><textarea className="textarea textarea-compact" name="objective" placeholder="O que a criança deve compreender, praticar ou demonstrar?" /></div>
        </section>

        <section className="enrollment-step enrollment-step-blue">
          <div className="enrollment-step-title"><span>3</span><div><h3>Conteúdo e questões</h3><p>Cole o texto ou escreva as questões uma por linha. Também dá para usar só um arquivo como fonte.</p></div></div>
          <div className="generator-input-grid">
            <div className="field"><label>Texto / conteúdo-base</label><textarea className="textarea generator-prompt" name="baseText" placeholder="Cole aqui o conteúdo que deve ser transformado." /></div>
            <div className="field"><label>Questões — uma por linha</label><textarea className="textarea generator-prompt" name="questions" placeholder={'1. Primeira questão\n2. Segunda questão\n3. Terceira questão'} /></div>
          </div>
        </section>

        <section className="enrollment-step enrollment-step-pink">
          <div className="enrollment-step-title"><span>4</span><div><h3>Arquivos</h3><p>A fonte traz o conteúdo; o modelo mostra a aparência ou estrutura que deve ser seguida.</p></div></div>
          <div className="generator-file-grid">
            <label className="generator-upload-drop">
              <strong>Anexar fonte</strong>
              <p>PDF, DOCX, XLSX, CSV ou TXT · até 10 MB</p>
              <input name="sourceFile" type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" />
              <small>Ex.: apostila, exercício, prova antiga, texto ou planilha.</small>
            </label>
            <label className="generator-upload-drop generator-model-drop">
              <strong>Anexar modelo visual <span className="field-optional">opcional</span></strong>
              <p>PDF, DOCX, XLSX, CSV ou TXT · até 10 MB</p>
              <input name="modelFile" type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" />
              <small>Ex.: um PDF CURIÓ já diagramado que deve servir de referência.</small>
            </label>
          </div>
        </section>

        <section className="enrollment-review-card">
          <div className="enrollment-step-title"><span>5</span><div><h3>Registrar transformação</h3><p>Nada é publicado sozinho. A saída precisa existir e ser revisada antes de entrar no uso pedagógico.</p></div></div>
          <div className="review-checks"><span>✓ Sem quiz duplicado</span><span>✓ Fonte e modelo separados</span><span>✓ Aceita PDF e planilha</span><span>✓ Revisão antes de publicar</span></div>
          <button className="button button-primary button-block enrollment-submit" type="submit">Escolher como transformar</button>
        </section>
      </form>

      <section className="panel">
        <div className="panel-head"><div><h2>Transformações recentes</h2><p>Status em linguagem de uso, sem códigos internos.</p></div></div>
        {jobs?.length ? (
          <div className="enrollment-card-list">
            {jobs.map((job: any) => {
              const input = job.input || {};
              const requestedType = input.requested_output_type || job.job_type;
              return <article className="enrollment-record-card" key={job.id}>
                <div className="enrollment-record-main">
                  <div><span className="record-kicker">{productLabel[requestedType] || productLabel[job.job_type] || "Material"}</span><h3>{input.title_hint || input.theme || "Transformação CURIÓ"}</h3><p>{input.source_file_name ? `Fonte: ${input.source_file_name}` : "Conteúdo preenchido no formulário"}{input.model_file_name ? ` • Modelo: ${input.model_file_name}` : ""}</p></div>
                  <Badge tone={statusTone(job.status)}>{statusLabel[job.status] || "Em andamento"}</Badge>
                </div>
                <small className="muted">Solicitado em {dateTime(job.created_at)}{job.finished_at ? ` • finalizado em ${dateTime(job.finished_at)}` : ""}</small>
                {job.status === "failed" && <p className="form-message form-error">Não foi possível concluir esta transformação. Revise a fonte e tente novamente.</p>}
              </article>;
            })}
          </div>
        ) : <EmptyState title="Nenhuma transformação ainda" description="Use o formulário acima para registrar a primeira fonte." />}
      </section>
    </>
  );
}
