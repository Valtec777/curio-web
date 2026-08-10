import { randomUUID } from "node:crypto";
import { Badge, PageHeader } from "@/components/ui";
import { MultiStudentPicker } from "@/components/multi-student-picker";
import { PromptCopyCard } from "@/components/prompt-copy-card";
import { getCurrentTeacher } from "@/lib/teacher";
import { queueCurioGeneration } from "@/app/professor/generator-actions";
import { createMission } from "@/app/professor/missoes/actions";
import { createTeacherMaterial } from "@/app/professor/materiais/actions";
import { createTeacherAssessment } from "@/app/professor/avaliacoes/actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function jobLabel(type?: string | null) {
  if (type === "mission") return "Missão";
  if (type === "notebook") return "Caderno";
  if (type === "material") return "Material";
  if (type === "assessment") return "Prova / avaliação";
  return "Documento";
}

function jobTone(status?: string | null): "green" | "yellow" | "pink" | "neutral" {
  if (status === "completed") return "green";
  if (status === "failed") return "pink";
  if (status === "cancelled") return "neutral";
  return "yellow";
}

export default async function TeacherCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return null;

  const [
    { data: subjects },
    { data: grades },
    { data: skills },
    { data: characters },
    { data: studentLinks },
    { data: gradingSchemes },
    { data: jobs },
  ] = await Promise.all([
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("grades").select("id,name,sort_order").eq("active", true).order("sort_order"),
    supabase.from("skills").select("id,name").eq("active", true).order("name").limit(160),
    supabase.from("characters").select("id,name,assets").eq("active", true).order("sort_order"),
    supabase.from("teacher_students").select("student_id,students(id,preferred_name,full_name,school_name,grades(name))").eq("teacher_id", teacher.id).eq("active", true),
    supabase.from("grading_schemes").select("id,name,scale_min,scale_max,passing_score").eq("active", true).order("name"),
    supabase.from("generation_jobs").select("id,job_type,status,error_message,created_at,input").eq("teacher_id", teacher.id).order("created_at", { ascending: false }).limit(6),
  ]);

  const students = (studentLinks ?? [])
    .filter((link: any) => link.students)
    .map((link: any) => ({
      id: link.student_id,
      name: link.students.preferred_name || link.students.full_name || "Aluno",
      detail: link.students.grades?.name || link.students.school_name || "",
    }));

  const mode = String(query.modo || "");
  const prompts = [
    {
      title: "Missão Cuca",
      prompt: "Crie uma Missão Cuca com linguagem adequada à faixa etária, objetivo claro, explicação curta, exemplo e questões progressivas. Para múltipla escolha, use quatro alternativas e informe o gabarito separado.",
    },
    {
      title: "Caderno Curió",
      prompt: "Transforme o conteúdo em uma atividade de treino para o Caderno Curió, pronta para PDF, com instruções simples, espaço de resposta, progressão de dificuldade e sem depender de interação na tela.",
    },
    {
      title: "Prova / revisão",
      prompt: "Monte uma avaliação ou revisão equilibrada, cobrindo os conteúdos do material-base, com enunciados claros, variedade de questões e gabarito separado para revisão do professor.",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Professor • Criar e publicar"
        title="Criar conteúdo"
        description="Um único lugar para gerar a partir de PDF ou prompt, ou montar manualmente uma Missão, Caderno, material ou avaliação."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="teacher-create-hero">
        <div>
          <Badge tone="purple">Duas formas de criar</Badge>
          <h2>Gerar rápido ou montar com controle total.</h2>
          <p>Se você tiver um PDF, anexe e escolha o formato. Se preferir montar à mão, abra somente o tipo que precisa; os formulários não ficam todos expostos ao mesmo tempo.</p>
        </div>
        <div className="teacher-create-tabs">
          <a href="#gerar">Gerar com PDF / prompt</a>
          <a href="#missao">Missão</a>
          <a href="#material">Material / Caderno</a>
          <a href="#avaliacao">Avaliação</a>
        </div>
      </section>

      <section className="panel" id="gerar">
        <div className="panel-head">
          <div>
            <h2>Gerar a partir de uma fonte</h2>
            <p>Anexe o PDF e escolha no que transformar. Os detalhes abaixo são opcionais; o sistema registra uma geração para processamento e revisão antes de qualquer publicação.</p>
          </div>
        </div>

        <form action={queueCurioGeneration} className="form-stack">
          <input type="hidden" name="returnTo" value="/professor/criar" />
          <div className="form-row">
            <div className="field">
              <label>Transformar em *</label>
              <select className="select" name="outputType" defaultValue="mission_cuca" required>
                <option value="mission_cuca">Missão Cuca</option>
                <option value="caderno_curio">Atividade / Caderno Curió</option>
                <option value="material_apoio">Material de apoio / PDF</option>
                <option value="modo_prova">Prova / revisão</option>
              </select>
            </div>
            <label className="generator-upload-drop">
              <strong>Anexar fonte</strong>
              <p>PDF, TXT ou DOCX · até 10 MB</p>
              <input name="sourceFile" type="file" accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
              <small>O arquivo é a fonte do conteúdo; não precisa reescrever o que já está nele.</small>
            </label>
          </div>

          <div className="field">
            <label>Ou cole uma instrução / prompt</label>
            <textarea className="textarea generator-prompt" name="prompt" placeholder="Ex.: Use este conteúdo para criar uma Missão Cuca de revisão com quatro questões progressivas." />
          </div>

          <details className="plan-editor">
            <summary>Opções de contexto <span className="field-optional">opcional</span></summary>
            <div className="form-stack compact-form">
              <div className="field"><label>Título desejado</label><input className="input" name="titleHint" /></div>
              <div className="form-row">
                <div className="field"><label>Aluno</label><select className="select" name="studentId" defaultValue=""><option value="">Sem aluno específico</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></div>
                <div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue=""><option value="">Inferir da fonte</option>{(subjects ?? []).map((subject: any) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
              </div>
              <div className="field"><label>Ano escolar</label><select className="select" name="gradeId" defaultValue=""><option value="">Inferir da fonte</option>{(grades ?? []).map((grade: any) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
            </div>
          </details>

          <button className="button button-primary" type="submit">Enviar para gerar</button>
        </form>
      </section>

      <div className="teacher-create-grid mt-16">
        <details className="teacher-create-card" id="missao" open={mode === "missao"}>
          <summary><strong>Missão Cuca manual</strong><span>Interativa, com questão e gabarito.</span></summary>
          <div className="teacher-create-body">
            <form action={createMission} className="form-stack">
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
              <input type="hidden" name="returnTo" value="/professor/criar" />
              <div className="field"><label>Título *</label><input className="input" name="title" required /></div>
              <div className="form-row">
                <div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue=""><option value="">Não definida</option>{(subjects ?? []).map((subject: any) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
                <div className="field"><label>Ano</label><select className="select" name="gradeId" defaultValue=""><option value="">Não definido</option>{(grades ?? []).map((grade: any) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
              </div>
              <div className="field"><label>Mascote</label><select className="select" name="characterId" defaultValue=""><option value="">Sem mascote específico</option>{(characters ?? []).map((character: any) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></div>
              <div className="field"><label>Objetivo *</label><textarea className="textarea" name="objective" required /></div>
              <div className="field"><label>Descrição / orientação</label><textarea className="textarea textarea-compact" name="description" /></div>
              <div className="form-row">
                <div className="field"><label>Duração estimada</label><input className="input" type="number" name="estimatedMinutes" min="5" max="180" defaultValue="20" required /></div>
                <div className="field"><label>Prazo</label><input className="input" type="date" name="dueAt" /></div>
              </div>
              <div className="field"><label>Habilidade principal *</label><select className="select" name="skillId" defaultValue="" required><option value="" disabled>Selecione</option>{(skills ?? []).map((skill: any) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></div>
              <div className="field"><label>Alunos</label><MultiStudentPicker students={students} /></div>

              <hr style={{ border: 0, borderTop: "1px solid var(--line)" }} />
              <div className="field"><label>Pergunta / desafio *</label><textarea className="textarea" name="prompt" required /></div>
              <div className="field"><label>Tipo</label><select className="select" name="questionType" defaultValue="multiple_choice"><option value="multiple_choice">Múltipla escolha</option><option value="open_text">Discursiva</option><option value="true_false">Verdadeiro ou falso</option></select></div>
              <div className="mission-option-builder">
                {(["A", "B", "C", "D"] as const).map((letter) => <div className="mission-option-row" key={letter}><label>{letter}</label><input className="input" name={`option${letter}`} placeholder={`Alternativa ${letter}`} /></div>)}
              </div>
              <div className="field">
                <label>Qual alternativa é a correta?</label>
                <div className="mission-answer-grid">
                  {(["A", "B", "C", "D"] as const).map((letter) => <label className="mission-answer-choice" key={letter}><input type="radio" name="correctOption" value={letter} /> Alternativa {letter}</label>)}
                </div>
                <small className="muted">No quiz objetivo, o gabarito fica salvo separado da questão para permitir correção automática sem mostrar a resposta ao aluno.</small>
              </div>
              <div className="field"><label>Pista <span className="field-optional">opcional</span></label><input className="input" name="hint" /></div>
              <button className="button button-primary" type="submit">Criar missão</button>
            </form>
          </div>
        </details>

        <details className="teacher-create-card" id="material" open={mode === "material"}>
          <summary><strong>Material ou Caderno</strong><span>PDF/imagem com publicação imediata ou programada.</span></summary>
          <div className="teacher-create-body">
            <form action={createTeacherMaterial} className="form-stack">
              <div className="field"><label>Formato *</label><select className="select" name="kind" defaultValue="notebook"><option value="notebook">Caderno Curió / treino</option><option value="material">Material de apoio</option></select></div>
              <div className="field"><label>Título *</label><input className="input" name="title" required /></div>
              <div className="field"><label>Descrição / instrução *</label><textarea className="textarea" name="description" required /></div>
              <div className="form-row">
                <div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue=""><option value="">Geral</option>{(subjects ?? []).map((subject: any) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
                <div className="field"><label>Ano</label><select className="select" name="gradeId" defaultValue=""><option value="">Geral</option>{(grades ?? []).map((grade: any) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
              </div>
              <div className="field"><label>Categoria</label><select className="select" name="category" defaultValue="pdf"><option value="pdf">PDF</option><option value="image">Imagem</option><option value="file">Arquivo</option><option value="other">Outro</option></select></div>
              <div className="field"><label>PDF ou imagem *</label><input className="input" type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" required /></div>
              <div className="field"><label>Alunos</label><MultiStudentPicker students={students} /></div>
              <div className="field"><label>Prazo</label><input className="input" type="date" name="dueAt" /></div>
              <div className="field"><label>Publicação</label><select className="select" name="publishMode" defaultValue="now"><option value="now">Publicar agora</option><option value="later">Publicar em dia e horário</option><option value="draft">Salvar como rascunho</option></select></div>
              <div className="field"><label>Dia e horário da publicação programada</label><input className="input" type="datetime-local" name="publishAt" /></div>
              <button className="button button-primary" type="submit">Salvar material</button>
            </form>
          </div>
        </details>

        <details className="teacher-create-card" id="avaliacao" open={mode === "avaliacao"}>
          <summary><strong>Avaliação</strong><span>Aluno, matéria, data, instruções e arquivo opcional.</span></summary>
          <div className="teacher-create-body">
            <form action={createTeacherAssessment} className="form-stack">
              <div className="field"><label>Título *</label><input className="input" name="title" required /></div>
              <div className="field"><label>Alunos *</label><MultiStudentPicker students={students} /></div>
              <div className="form-row">
                <div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue=""><option value="">Geral</option>{(subjects ?? []).map((subject: any) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
                <div className="field"><label>Ano</label><select className="select" name="gradeId" defaultValue=""><option value="">Não definido</option>{(grades ?? []).map((grade: any) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
              </div>
              <div className="field"><label>Data e horário *</label><input className="input" type="datetime-local" name="scheduledFor" required /></div>
              <div className="field"><label>Conteúdo / observação</label><textarea className="textarea" name="instructions" /></div>
              <div className="field"><label>Critério de nota</label><select className="select" name="gradingSchemeId" defaultValue=""><option value="">Sem escala específica</option>{(gradingSchemes ?? []).map((scheme: any) => <option key={scheme.id} value={scheme.id}>{scheme.name} · {scheme.scale_min} a {scheme.scale_max}</option>)}</select></div>
              <div className="field"><label>Arquivo <span className="field-optional">opcional</span></label><input className="input" type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" /></div>
              <button className="button button-primary" type="submit">Criar avaliação</button>
            </form>
          </div>
        </details>
      </div>

      <div className="teacher-section-grid mt-16">
        <section className="panel">
          <div className="panel-head"><div><h2>Prompts prontos</h2><p>Para quando você quiser gerar em outra IA e só trazer a estrutura para o CURIÓ.</p></div></div>
          <div className="teacher-resource-list">{prompts.map((item) => <PromptCopyCard key={item.title} title={item.title} prompt={item.prompt} />)}</div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h2>Gerações recentes</h2><p>O status abaixo é o status real da fila. Um pedido só aparece como pronto quando o processador produzir uma saída.</p></div></div>
          {jobs?.length ? <div className="teacher-resource-list">{jobs.map((job: any) => <article className="teacher-resource-card" key={job.id}><div className="flex space-between gap-8 wrap"><strong>{job.input?.title_hint || jobLabel(job.job_type)}</strong><Badge tone={jobTone(job.status)}>{job.status === "queued" ? "Na fila" : job.status === "running" ? "Gerando" : job.status === "completed" ? "Pronto para revisar" : job.status === "failed" ? "Falhou" : job.status}</Badge></div><small className="muted">{jobLabel(job.job_type)} · {dt(job.created_at)}</small>{job.error_message && <p className="form-message form-error">{job.error_message}</p>}</article>)}</div> : <p className="muted">Nenhuma geração registrada.</p>}
        </section>
      </div>
    </>
  );
}
