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
  course: "Curso livre",
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

const validTypes = new Set(["mission", "notebook", "material", "assessment", "report", "course"]);

export default async function AdminGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; tipo?: string }>;
}) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const defaultType = validTypes.has(String(query.tipo || "")) ? String(query.tipo) : "mission";

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
        description="O caminho principal é simples: cole um prompt ou anexe uma fonte, escolha o resultado e envie para gerar. Os detalhes extras ficam opcionais."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="generator-admin-hero">
        <div>
          <Badge tone="yellow">Processamento final em validação</Badge>
          <h2>PDF ou prompt → escolha do formato → rascunho para revisão</h2>
          <p>Você não precisa preencher tema, objetivo e questões para começar. Um arquivo ou um prompt já basta. A saída final só será marcada como pronta quando o processamento real produzir o material.</p>
        </div>
        <div className="generator-product-pills" aria-label="Formatos do gerador">
          <span>Missão</span><span>Caderno</span><span>Material</span><span>Prova</span><span>Curso</span>
        </div>
      </section>

      <form action={queueAdminGeneration} className="generator-quick-shell">
        <div className="generator-quick-grid">
          <section className="generator-quick-card">
            <h3>1. Cole o prompt ou conteúdo</h3>
            <p>Se preferir usar apenas um arquivo, pode deixar este campo vazio.</p>
            <textarea className="textarea generator-prompt" name="baseText" placeholder="Ex.: transforme este conteúdo em uma Missão sobre frações para o 6º ano, com linguagem leve e desafios progressivos." />
          </section>

          <section className="generator-quick-card">
            <h3>Ou anexe a fonte</h3>
            <p>PDF, DOCX, XLSX, CSV ou TXT · até 10 MB.</p>
            <label className="generator-upload-drop">
              <strong>Escolher arquivo</strong>
              <input name="sourceFile" type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" />
              <small>Apostila, atividade, prova antiga, texto ou planilha.</small>
            </label>
          </section>
        </div>

        <div className="generator-quick-grid">
          <section className="generator-quick-card">
            <h3>2. Escolha no que transformar</h3>
            <p>O antigo quiz fica dentro de Missão; não precisa existir como produto separado.</p>
            <div className="field">
              <label>Resultado desejado *</label>
              <select className="select" name="outputType" defaultValue={defaultType} required>
                <option value="mission">Missão — interativa no CURIÓ</option>
                <option value="notebook">Atividade / Caderno CURIÓ</option>
                <option value="material">Material de apoio / PDF</option>
                <option value="assessment">Prova / revisão</option>
                <option value="report">Relatório / documento</option>
                <option value="course">Curso livre — etapas, vídeos, links e prática</option>
              </select>
            </div>
          </section>

          <section className="generator-quick-card">
            <h3>Modelo visual</h3>
            <p>Opcional. Anexe um PDF ou arquivo CURIÓ que deve servir de referência de aparência ou estrutura.</p>
            <label className="generator-upload-drop generator-model-drop">
              <strong>Escolher modelo</strong>
              <input name="modelFile" type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" />
              <small>Fonte e modelo ficam separados para não confundir conteúdo com acabamento.</small>
            </label>
          </section>
        </div>

        <details className="generator-advanced">
          <summary>Personalizar mais — opcional</summary>
          <div className="generator-advanced-body">
            <div className="form-row">
              <div className="field"><label>Título</label><input className="input" name="title" placeholder="Ex.: Revisão de frações" /></div>
              <div className="field"><label>Tema</label><input className="input" name="theme" placeholder="Ex.: Frações equivalentes" /></div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Matéria</label>
                <select className="select" name="subjectId" defaultValue="">
                  <option value="">Inferir ou escolher depois</option>
                  {(subjects ?? []).map((subject: any) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Ano escolar</label>
                <select className="select" name="gradeId" defaultValue="">
                  <option value="">Inferir ou escolher depois</option>
                  {(grades ?? []).map((grade: any) => <option value={grade.id} key={grade.id}>{grade.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Professor</label>
                <select className="select" name="teacherId" defaultValue="">
                  <option value="">Sem professor específico</option>
                  {(teachers ?? []).map((teacher: any) => <option value={teacher.id} key={teacher.id}>{teacher.profiles?.preferred_name || teacher.profiles?.full_name || "Professor"}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Aluno</label>
                <select className="select" name="studentId" defaultValue="">
                  <option value="">Sem aluno específico</option>
                  {(students ?? []).map((student: any) => <option value={student.id} key={student.id}>{student.preferred_name || student.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Objetivo</label><textarea className="textarea textarea-compact" name="objective" /></div>
            <div className="field"><label>Questões — uma por linha</label><textarea className="textarea textarea-compact" name="questions" /></div>
          </div>
        </details>

        <button className="button button-primary button-block" type="submit">Enviar para gerar</button>
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
                  <div><span className="record-kicker">{productLabel[requestedType] || productLabel[job.job_type] || "Material"}</span><h3>{input.title_hint || input.theme || "Transformação CURIÓ"}</h3><p>{input.source_file_name ? `Fonte: ${input.source_file_name}` : "Conteúdo enviado por texto"}{input.model_file_name ? ` • Modelo: ${input.model_file_name}` : ""}</p></div>
                  <Badge tone={statusTone(job.status)}>{statusLabel[job.status] || "Em andamento"}</Badge>
                </div>
                <small className="muted">Solicitado em {dateTime(job.created_at)}{job.finished_at ? ` • finalizado em ${dateTime(job.finished_at)}` : ""}</small>
                {job.status === "failed" && <p className="form-message form-error">Não foi possível concluir esta transformação. Revise a fonte e tente novamente.</p>}
              </article>;
            })}
          </div>
        ) : <EmptyState title="Nenhuma transformação ainda" description="Cole um prompt ou anexe uma fonte para começar." />}
      </section>
    </>
  );
}
