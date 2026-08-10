import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import { PromptCopyCard } from "@/components/prompt-copy-card";
import { getCurrentTeacher } from "@/lib/teacher";
import { queueCurioGeneration } from "@/app/professor/generator-actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function jobLabel(type?: string | null) {
  if (type === "mission") return "Missão";
  if (type === "notebook") return "Caderno";
  if (type === "material") return "Material";
  if (type === "assessment") return "Avaliação";
  return "Documento";
}

function jobTone(status?: string | null): "green" | "yellow" | "pink" | "neutral" {
  if (status === "completed") return "green";
  if (status === "failed") return "pink";
  if (status === "cancelled") return "neutral";
  return "yellow";
}

const prompts = [
  {
    title: "Missão Cuca",
    prompt: `Você está criando conteúdo para o sistema CURIÓ. Gere uma MISSÃO CUCA e responda SOMENTE em JSON válido, sem markdown e sem texto antes/depois.

O objeto deve começar obrigatoriamente com:
"curio_type": "mission_cuca"

Formato obrigatório:
{
  "curio_type": "mission_cuca",
  "title": "",
  "subject": "",
  "grade": "",
  "mascot": "",
  "objective": "",
  "description": "",
  "estimated_minutes": 20,
  "questions": [
    {
      "type": "multiple_choice | true_false | open_text",
      "prompt": "",
      "hint": "",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "texto exato da alternativa correta ou null"
    }
  ]
}

Crie várias questões progressivas (não apenas uma). Em múltipla escolha use exatamente 4 alternativas. O gabarito deve ficar em correct_answer. Em questão discursiva use options=[] e correct_answer=null. Adapte linguagem e dificuldade ao ano escolar informado no conteúdo-base.`,
  },
  {
    title: "Atividade / Caderno Curió",
    prompt: `Você está criando conteúdo para o sistema CURIÓ. Gere uma ATIVIDADE DE CADERNO e responda SOMENTE em JSON válido, sem markdown e sem texto antes/depois.

O objeto deve começar obrigatoriamente com:
"curio_type": "caderno_curio"

Formato obrigatório:
{
  "curio_type": "caderno_curio",
  "title": "",
  "subject": "",
  "grade": "",
  "objective": "",
  "instructions": "",
  "sections": [
    {"title": "", "instructions": "", "exercises": ["", ""]}
  ],
  "answer_key": [""],
  "pdf_layout_notes": "folha pronta para impressão, com espaço suficiente para resposta"
}

O Caderno Curió é treino para fazer fora da tela. Crie exercícios progressivos, enunciados claros, espaço de resposta e gabarito separado.`,
  },
  {
    title: "Material de apoio",
    prompt: `Você está criando conteúdo para o sistema CURIÓ. Gere um MATERIAL DE APOIO e responda SOMENTE em JSON válido, sem markdown e sem texto antes/depois.

O objeto deve começar obrigatoriamente com:
"curio_type": "material_apoio"

Formato obrigatório:
{
  "curio_type": "material_apoio",
  "title": "",
  "subject": "",
  "grade": "",
  "summary": "",
  "explanation": [""],
  "examples": [""],
  "key_points": [""],
  "quick_check": [""],
  "pdf_layout_notes": "material visual, objetivo e pronto para leitura/PDF"
}

Organize o conteúdo para consulta rápida do aluno. Não transforme automaticamente em quiz ou prova.`,
  },
  {
    title: "Avaliação / prova",
    prompt: `Você está criando conteúdo para o sistema CURIÓ. Gere uma AVALIAÇÃO e responda SOMENTE em JSON válido, sem markdown e sem texto antes/depois.

O objeto deve começar obrigatoriamente com:
"curio_type": "assessment"

Formato obrigatório:
{
  "curio_type": "assessment",
  "title": "",
  "subject": "",
  "grade": "",
  "instructions": "",
  "questions": [
    {
      "type": "multiple_choice | true_false | open_text",
      "prompt": "",
      "options": [],
      "correct_answer": null,
      "points": 1
    }
  ],
  "answer_key": [""],
  "total_points": 10
}

Distribua as questões de forma equilibrada pelos conteúdos informados. Em múltipla escolha use 4 alternativas e mantenha o gabarito separado.`,
  },
];

const outputTypes = [
  { value: "mission_cuca", title: "Missão Cuca", detail: "Quiz e desafios interativos" },
  { value: "caderno_curio", title: "Atividade / Caderno", detail: "Treino para PDF e impressão" },
  { value: "material_apoio", title: "Material de apoio", detail: "Explicação e consulta" },
  { value: "modo_prova", title: "Avaliação", detail: "Prova ou revisão estruturada" },
];

export default async function TeacherCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ fonte?: string; erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return null;

  const [{ data: subjects }, { data: grades }, { data: studentLinks }, { data: jobs }] = await Promise.all([
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("grades").select("id,name,sort_order").eq("active", true).order("sort_order"),
    supabase.from("teacher_students").select("student_id,students(preferred_name,full_name)").eq("teacher_id", teacher.id).eq("active", true),
    supabase.from("generation_jobs").select("id,job_type,status,error_message,created_at,input").eq("teacher_id", teacher.id).order("created_at", { ascending: false }).limit(6),
  ]);

  const source = query.fonte === "prompt" ? "prompt" : "pdf";
  const students = (studentLinks ?? []).filter((link: any) => link.students).map((link: any) => ({
    id: link.student_id,
    name: link.students.preferred_name || link.students.full_name || "Aluno",
  }));

  return (
    <>
      <PageHeader
        eyebrow="Professor • Criar e publicar"
        title="Criar conteúdo"
        description="Escolha o que quer fazer. Cada formato abre no editor certo, sem ocupar a tela com formulários que você não está usando."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="panel">
        <div className="panel-head"><div><h2>Montar manualmente</h2><p>Abra somente o editor que precisa agora.</p></div></div>
        <div className="teacher-create-launch-grid">
          <Link className="teacher-create-launch" href="/professor/missoes/nova">
            <span className="teacher-create-launch-icon" aria-hidden="true">★</span>
            <strong>Missão Cuca</strong>
            <span>Monte várias questões, alternativas, gabarito, prazo e alunos.</span>
          </Link>
          <Link className="teacher-create-launch" href="/professor/materiais/novo?tipo=notebook">
            <span className="teacher-create-launch-icon" aria-hidden="true">✎</span>
            <strong>Atividade / Caderno</strong>
            <span>Treino em PDF ou imagem para fazer fora da tela.</span>
          </Link>
          <Link className="teacher-create-launch" href="/professor/materiais/novo?tipo=material">
            <span className="teacher-create-launch-icon" aria-hidden="true">▤</span>
            <strong>Material de apoio</strong>
            <span>Conteúdo para leitura, consulta e acompanhamento.</span>
          </Link>
          <Link className="teacher-create-launch" href="/professor/avaliacoes/nova">
            <span className="teacher-create-launch-icon" aria-hidden="true">✓</span>
            <strong>Avaliação</strong>
            <span>Informe prova, data, conteúdo, alunos e arquivo opcional.</span>
          </Link>
        </div>
      </section>

      <section className="panel mt-16">
        <div className="panel-head">
          <div>
            <Badge tone="purple">Gerador</Badge>
            <h2>Usar uma fonte pronta</h2>
            <p>Primeiro escolha se vai anexar um arquivo ou usar um prompt. Depois escolha o formato que o CURIÓ deve produzir.</p>
          </div>
        </div>

        <div className="teacher-source-tabs">
          <Link className={`teacher-source-tab${source === "pdf" ? " is-active" : ""}`} href="/professor/criar?fonte=pdf">Anexar PDF</Link>
          <Link className={`teacher-source-tab${source === "prompt" ? " is-active" : ""}`} href="/professor/criar?fonte=prompt">Usar prompt</Link>
        </div>

        {source === "pdf" ? (
          <form action={queueCurioGeneration} className="form-stack">
            <input type="hidden" name="returnTo" value="/professor/criar?fonte=pdf" />
            <div className="field">
              <label>O que este arquivo deve virar? *</label>
              <div className="teacher-generation-types">
                {outputTypes.map((type, index) => (
                  <label className="teacher-generation-type" key={type.value}>
                    <input type="radio" name="outputType" value={type.value} defaultChecked={index === 0} />
                    <strong>{type.title}</strong>
                    <small>{type.detail}</small>
                  </label>
                ))}
              </div>
            </div>

            <label className="generator-upload-drop">
              <strong>Anexar fonte</strong>
              <p>PDF, TXT ou DOCX · até 10 MB</p>
              <input name="sourceFile" type="file" accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
              <small>O arquivo serve como fonte. O resultado continua exigindo revisão do professor antes de publicar.</small>
            </label>

            <details className="plan-editor">
              <summary>Contexto opcional</summary>
              <div className="form-stack compact-form">
                <div className="field"><label>Título desejado</label><input className="input" name="titleHint" /></div>
                <div className="form-row">
                  <div className="field"><label>Aluno</label><select className="select" name="studentId" defaultValue=""><option value="">Sem aluno específico</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></div>
                  <div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue=""><option value="">Inferir da fonte</option>{(subjects ?? []).map((subject: any) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
                </div>
                <div className="field"><label>Ano escolar</label><select className="select" name="gradeId" defaultValue=""><option value="">Inferir da fonte</option>{(grades ?? []).map((grade: any) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
              </div>
            </details>

            <button className="button button-primary" type="submit">Enviar PDF para o gerador</button>
          </form>
        ) : (
          <div className="form-stack">
            <div className="notice">Os prompts abaixo já dizem ao modelo qual é o <strong>tipo CURIÓ</strong> e qual estrutura devolver. Isso evita receber um texto solto que o sistema não consegue reconhecer depois.</div>
            <div className="teacher-section-grid">
              {prompts.map((item) => <PromptCopyCard key={item.title} title={item.title} prompt={item.prompt} />)}
            </div>

            <form action={queueCurioGeneration} className="form-stack">
              <input type="hidden" name="returnTo" value="/professor/criar?fonte=prompt" />
              <div className="field">
                <label>Qual formato você vai colar? *</label>
                <div className="teacher-generation-types">
                  {outputTypes.map((type, index) => (
                    <label className="teacher-generation-type" key={type.value}>
                      <input type="radio" name="outputType" value={type.value} defaultChecked={index === 0} />
                      <strong>{type.title}</strong>
                      <small>{type.detail}</small>
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Cole aqui o resultado estruturado da IA</label>
                <textarea className="textarea generator-prompt" name="prompt" required placeholder='Ex.: {"curio_type":"mission_cuca", ...}' />
                <small className="muted">O conteúdo entra na fila como fonte estruturada para processamento e revisão. Ele não é publicado automaticamente.</small>
              </div>
              <button className="button button-primary" type="submit">Enviar conteúdo estruturado</button>
            </form>
          </div>
        )}
      </section>

      <section className="panel mt-16">
        <div className="panel-head"><div><h2>Gerações recentes</h2><p>O status exibido é o status real da fila; “Pronto” só aparece quando houver saída processada.</p></div></div>
        {jobs?.length ? <div className="teacher-resource-list">{jobs.map((job: any) => (
          <article className="teacher-resource-card" key={job.id}>
            <div className="flex space-between gap-8 wrap"><strong>{job.input?.title_hint || jobLabel(job.job_type)}</strong><Badge tone={jobTone(job.status)}>{job.status === "queued" ? "Na fila" : job.status === "running" ? "Gerando" : job.status === "completed" ? "Pronto para revisar" : job.status === "failed" ? "Falhou" : job.status}</Badge></div>
            <small className="muted">{jobLabel(job.job_type)} · {dt(job.created_at)}</small>
            {job.error_message && <p className="form-message form-error">{job.error_message}</p>}
          </article>
        ))}</div> : <p className="muted">Nenhuma geração registrada.</p>}
      </section>
    </>
  );
}
