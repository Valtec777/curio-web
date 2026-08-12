import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import {
  archiveContentPreparationDraft,
  removeContentPreparationQuestion,
  saveContentPreparationQuestion,
  updateContentPreparationDraft,
} from "../../actions";
import { convertPreparationDraft } from "../../conversion-actions";

const questionOptions = [
  ["multiple_choice", "Múltipla escolha"], ["true_false", "Verdadeiro ou falso"], ["open_text", "Discursiva"],
  ["matching", "Associação"], ["fill_blank", "Complete a frase"], ["ordering", "Ordenação"],
  ["interpretation", "Interpretação"], ["problem", "Situação-problema"],
];
const formatOptions = [
  ["mission", "Missão"], ["quiz", "Quiz"], ["activity", "Atividade"], ["material", "Material"], ["assessment", "Avaliação"], ["notebook_pdf", "Caderno / PDF"],
];
const outputLabels: Record<string, string> = { mission: "Missão", quiz: "Quiz", activity: "Atividade", material: "Material", assessment: "Avaliação", notebook_pdf: "Caderno / PDF" };

function difficultyLabel(value: string) {
  return value === "easy" ? "Mais acessível" : value === "hard" ? "Desafiadora" : "Intermediária";
}

export default async function ContentPreparationReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return null;
  const [{ data: draft }, { data: questions }, { data: outputs }, { data: subjects }, { data: grades }] = await Promise.all([
    supabase.from("content_preparation_drafts").select("id,title,source_kind,source_text,source_file_path,source_file_name,source_mime_type,subject_id,grade_id,theme,objective,skill_text,age_label,difficulty,desired_question_count,question_types,target_formats,notes,estimated_minutes,status,updated_at").eq("id", id).eq("created_by_teacher_id", teacher.id).maybeSingle(),
    supabase.from("content_preparation_questions").select("id,draft_id,position,question_type,prompt,options,correct_value,explanation,hint").eq("draft_id", id).order("position"),
    supabase.from("content_preparation_outputs").select("output_type,output_id,created_at").eq("draft_id", id).order("created_at"),
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("grades").select("id,name").eq("active", true).order("sort_order"),
  ]);
  if (!draft) notFound();

  let sourceUrl: string | null = null;
  if (draft.source_file_path) {
    const { data } = await supabase.storage.from("generation-sources").createSignedUrl(draft.source_file_path, 60 * 20);
    sourceUrl = data?.signedUrl || null;
  }
  const outputTypes = new Set((outputs ?? []).map((item: any) => item.output_type));

  return <>
    <PageHeader eyebrow="Professor • Preparação" title={draft.title || "Revisar conteúdo"} description="Edite a estrutura antes de transformá-la em Missão, material, avaliação ou Caderno." action={<Link className="button button-secondary" href="/professor/criar">Voltar a Criar conteúdo</Link>} />
    {query.erro && <div className="form-message form-error">{query.erro}</div>}
    {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

    <section className="panel family-highlight">
      <div className="flex space-between gap-8 wrap"><div><strong>Fonte preservada</strong><p className="mb-0">Este rascunho é uma camada de revisão. Criar um formato final não apaga a fonte nem as outras possibilidades de saída.</p></div><Badge tone={draft.status === "converted" ? "green" : "blue"}>{draft.status === "converted" ? "Já gerou conteúdo final" : "Em revisão"}</Badge></div>
      {draft.source_file_name && <p className="mt-12">Arquivo: <strong>{draft.source_file_name}</strong>{sourceUrl ? <> · <a href={sourceUrl} target="_blank" rel="noreferrer">abrir fonte ↗</a></> : null}</p>}
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Contexto e instruções</h2><p>O processador futuro preencherá estes campos; o Professor sempre poderá corrigir tudo aqui.</p></div></div>
      <form action={updateContentPreparationDraft} className="form-stack">
        <input type="hidden" name="draftId" value={draft.id} />
        <div className="form-row"><div className="field"><label>Título</label><input className="input" name="title" defaultValue={draft.title || ""} required /></div><div className="field"><label>Tema</label><input className="input" name="theme" defaultValue={draft.theme || ""} /></div></div>
        <div className="form-row"><div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue={draft.subject_id || ""}><option value="">Não definida</option>{subjects?.map((s: any) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></div><div className="field"><label>Série / ano</label><select className="select" name="gradeId" defaultValue={draft.grade_id || ""}><option value="">Não definida</option>{grades?.map((g: any) => <option value={g.id} key={g.id}>{g.name}</option>)}</select></div></div>
        <div className="field"><label>Objetivo</label><textarea className="textarea" name="objective" defaultValue={draft.objective || ""} /></div>
        <div className="form-row"><div className="field"><label>Habilidade</label><input className="input" name="skillText" defaultValue={draft.skill_text || ""} /></div><div className="field"><label>Faixa etária</label><input className="input" name="ageLabel" defaultValue={draft.age_label || ""} /></div></div>
        <div className="form-row"><div className="field"><label>Dificuldade</label><select className="select" name="difficulty" defaultValue={draft.difficulty}><option value="easy">Mais acessível</option><option value="medium">Intermediária</option><option value="hard">Desafiadora</option></select></div><div className="field"><label>Questões desejadas</label><input className="input" type="number" name="desiredQuestionCount" min="0" max="50" defaultValue={draft.desired_question_count} /></div><div className="field"><label>Duração (min)</label><input className="input" type="number" name="estimatedMinutes" min="1" max="300" defaultValue={draft.estimated_minutes} /></div></div>
        <div className="field"><label>Texto fonte / conteúdo extraído</label><textarea className="textarea" name="sourceText" defaultValue={draft.source_text || ""} /></div>
        <div className="field"><label>Tipos de questão</label><div className="flex gap-8 wrap">{questionOptions.map(([value, label]) => <label className="consent-line" key={value}><input type="checkbox" name="questionTypes" value={value} defaultChecked={(draft.question_types || []).includes(value)} /> {label}</label>)}</div></div>
        <div className="field"><label>Formatos desejados</label><div className="flex gap-8 wrap">{formatOptions.map(([value, label]) => <label className="consent-line" key={value}><input type="checkbox" name="targetFormats" value={value} defaultChecked={(draft.target_formats || []).includes(value)} /> {label}</label>)}</div></div>
        <div className="field"><label>Observações para o Professor</label><textarea className="textarea" name="notes" defaultValue={draft.notes || ""} /></div>
        <button className="button button-secondary" type="submit">Salvar revisão</button>
      </form>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Questões preparadas</h2><p>Edite enunciado, tipo, alternativas, resposta, explicação e pista. Nada está travado.</p></div><Badge tone="blue">{questions?.length || 0} questão(ões)</Badge></div>
      {questions?.length ? <div className="form-stack">{questions.map((question: any) => <details className="plan-editor" key={question.id} open={(questions?.length || 0) <= 3}><summary>Questão {question.position} · {questionOptions.find(([value]) => value === question.question_type)?.[1] || question.question_type}</summary><form action={saveContentPreparationQuestion} className="form-stack plan-form"><input type="hidden" name="draftId" value={draft.id} /><input type="hidden" name="questionId" value={question.id} /><div className="form-row"><div className="field"><label>Posição</label><input className="input" type="number" min="1" name="position" defaultValue={question.position} /></div><div className="field"><label>Tipo</label><select className="select" name="questionType" defaultValue={question.question_type}>{questionOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div></div><div className="field"><label>Enunciado</label><textarea className="textarea" name="prompt" defaultValue={question.prompt || ""} required /></div><div className="field"><label>Alternativas / itens <span className="field-optional">uma por linha</span></label><textarea className="textarea textarea-compact" name="options" defaultValue={Array.isArray(question.options) ? question.options.join("\n") : ""} /></div><div className="field"><label>Resposta correta / referência</label><input className="input" name="correctValue" defaultValue={question.correct_value || ""} /></div><div className="field"><label>Explicação da resposta</label><textarea className="textarea textarea-compact" name="explanation" defaultValue={question.explanation || ""} /></div><div className="field"><label>Pista</label><input className="input" name="hint" defaultValue={question.hint || ""} /></div><button className="button button-secondary button-small" type="submit">Salvar questão</button></form><form action={removeContentPreparationQuestion}><input type="hidden" name="draftId" value={draft.id} /><input type="hidden" name="questionId" value={question.id} /><button className="button button-danger button-small" type="submit">Excluir questão do rascunho</button></form></details>)}</div> : <EmptyState title="Nenhuma questão preparada ainda" description="Adicione questões manualmente agora. Quando o processador estiver habilitado, ele poderá preencher esta mesma estrutura automaticamente." />}

      <details className="course-add-module mt-16"><summary>Adicionar questão</summary><form action={saveContentPreparationQuestion} className="form-stack plan-form"><input type="hidden" name="draftId" value={draft.id} /><div className="form-row"><div className="field"><label>Posição</label><input className="input" type="number" min="1" name="position" defaultValue={(questions?.length || 0) + 1} /></div><div className="field"><label>Tipo</label><select className="select" name="questionType" defaultValue="multiple_choice">{questionOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div></div><div className="field"><label>Enunciado</label><textarea className="textarea" name="prompt" required /></div><div className="field"><label>Alternativas / itens <span className="field-optional">uma por linha</span></label><textarea className="textarea textarea-compact" name="options" /></div><div className="field"><label>Resposta correta / referência</label><input className="input" name="correctValue" /></div><div className="field"><label>Explicação</label><textarea className="textarea textarea-compact" name="explanation" /></div><div className="field"><label>Pista</label><input className="input" name="hint" /></div><button className="button button-primary button-small" type="submit">Adicionar questão</button></form></details>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Transformar em conteúdo final</h2><p>Todos os destinos nascem como rascunho. Missão/Quiz abre o editor final; os demais formatos criam um rascunho no fluxo já existente.</p></div></div>
      <div className="teacher-create-launch-grid teacher-create-launch-grid-clean">
        <article className="teacher-create-launch is-mission"><strong>Missão / Quiz</strong><span>Carrega título, matéria, série, objetivo e questões compatíveis no editor de Missão.</span>{outputTypes.has("mission") || outputTypes.has("quiz") ? <Badge tone="green">Já criado</Badge> : <Link className="button button-primary button-small" href={`/professor/missoes/nova?rascunho=${draft.id}`}>Abrir no editor de Missão</Link>}</article>
        {(["material", "activity", "assessment", "notebook_pdf"] as const).map((type) => <article className="teacher-create-launch" key={type}><strong>{outputLabels[type]}</strong><span>{type === "notebook_pdf" ? "Usa o PDF/imagem fonte como Caderno em rascunho. Texto puro aguardará o gerador visual CURIÓ." : "Cria um rascunho no módulo final, sem publicar nem escolher alunos automaticamente."}</span>{outputTypes.has(type) ? <Badge tone="green">Já criado</Badge> : <form action={convertPreparationDraft}><input type="hidden" name="draftId" value={draft.id} /><input type="hidden" name="outputType" value={type} /><button className="button button-secondary button-small" type="submit">Criar rascunho de {outputLabels[type]}</button></form>}</article>)}
      </div>
      {outputs?.length ? <div className="notice mt-16"><strong>Saídas já criadas:</strong> {(outputs ?? []).map((item: any) => outputLabels[item.output_type] || item.output_type).join(", ")}. O rascunho de preparação continua disponível para outras versões.</div> : null}
    </section>

    <section className="panel"><div className="flex space-between gap-8 wrap"><div><h2 className="mt-0">Arquivar esta preparação</h2><p className="mb-0 muted">Arquivar esconde o rascunho da lista principal, sem apagar conteúdos finais já criados.</p></div><form action={archiveContentPreparationDraft}><input type="hidden" name="draftId" value={draft.id} /><button className="button button-danger button-small" type="submit">Arquivar rascunho</button></form></div></section>
  </>;
}
