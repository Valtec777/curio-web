import { getCurrentTeacher } from "@/lib/teacher";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { reviewAnswer, reviewNotebookAssignment } from "./actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function deliveryTone(submittedAt?: string | null, dueAt?: string | null): "green" | "yellow" | "neutral" {
  if (!dueAt) return "neutral";
  return new Date(submittedAt || 0) <= new Date(dueAt) ? "green" : "yellow";
}

function deliveryLabel(submittedAt?: string | null, dueAt?: string | null) {
  if (!dueAt) return "Sem prazo definido";
  return new Date(submittedAt || 0) <= new Date(dueAt) ? "Entregue no prazo" : "Entregue com atraso";
}

export default async function CorrectionsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const params = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil incompleto" description="Falta o registro de professor." />;

  const [{ data: submissions }, { data: notebooks }] = await Promise.all([
    supabase
      .from("submissions")
      .select(`
        id,student_id,submitted_at,review_status,
        students(preferred_name,full_name),
        mission_students(id,due_at,mission_id,missions(title)),
        answers(id,answer_text,score,reviewed_at,question_id,mission_questions(id,prompt,question_type,primary_skill_id,skills(name)))
      `)
      .eq("review_status", "pending")
      .order("submitted_at", { ascending: true }),
    supabase
      .from("notebook_assignments")
      .select("id,student_id,status,due_at,submitted_at,submission_photo_path,score,students(preferred_name,full_name),notebook_activities(title,description)")
      .eq("assigned_by_teacher_id", teacher.id)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true }),
  ]);

  const missionPending = (submissions ?? []).filter((submission: any) => (submission.answers ?? []).some((answer: any) => !answer.reviewed_at));
  const total = missionPending.length + (notebooks?.length ?? 0);

  return (
    <>
      <PageHeader
        eyebrow="Professor • Revisar"
        title="Correções"
        description="Veja quando o aluno entregou, se estava no prazo e o que realmente precisa de correção humana. Questões objetivas são conferidas automaticamente pelo gabarito."
      />
      {params.erro && <div className="form-message form-error">{params.erro}</div>}
      {params.sucesso && <div className="form-message form-success">{params.sucesso}</div>}

      <div className="notice">A correção automática vale somente para múltipla escolha e verdadeiro/falso com gabarito. Respostas abertas e Caderno Curió continuam sob decisão do professor.</div>

      {total ? (
        <div className="form-stack mt-16">
          {missionPending.map((submission: any) => {
            const assignment = submission.mission_students;
            const dueAt = assignment?.due_at;
            const autoAnswers = (submission.answers ?? []).filter((answer: any) => answer.reviewed_at && answer.score != null);
            const autoScore = autoAnswers.length ? Math.round((autoAnswers.reduce((sum: number, answer: any) => sum + Number(answer.score), 0) / autoAnswers.length) * 100) : null;
            return (
              <section className="panel" key={submission.id}>
                <div className="panel-head">
                  <div>
                    <div className="flex gap-8 wrap">
                      <Badge tone="pink">{submission.students?.preferred_name || submission.students?.full_name || "Aluno"}</Badge>
                      <Badge tone={deliveryTone(submission.submitted_at, dueAt)}>{deliveryLabel(submission.submitted_at, dueAt)}</Badge>
                      {autoScore != null && <Badge tone="green">Objetivas: {autoScore}%</Badge>}
                    </div>
                    <h2>{assignment?.missions?.title || "Missão"}</h2>
                    <p>Enviada em {dt(submission.submitted_at)}{dueAt ? ` · prazo ${dt(dueAt)}` : ""}</p>
                  </div>
                </div>

                {(submission.answers ?? []).map((answer: any) => {
                  const question = answer.mission_questions;
                  if (answer.reviewed_at) return null;
                  return (
                    <form action={reviewAnswer} className="question-box" key={answer.id}>
                      <input type="hidden" name="submissionId" value={submission.id} />
                      <input type="hidden" name="answerId" value={answer.id} />
                      <input type="hidden" name="studentId" value={submission.student_id} />
                      <input type="hidden" name="questionId" value={answer.question_id} />
                      <input type="hidden" name="skillId" value={question?.primary_skill_id || ""} />
                      <div className="eyebrow">{question?.skills?.name || "Habilidade"}</div>
                      <h3>{question?.prompt}</h3>
                      <div className="review-answer"><strong>Resposta do aluno</strong><p className="mb-0">{answer.answer_text || "Sem resposta textual."}</p></div>
                      <div className="teacher-grade-row">
                        <div className="field"><label>Nota 0–10</label><input className="input" type="number" name="score10" min="0" max="10" step="0.1" defaultValue="7" required /></div>
                        <div className="field"><label>Domínio</label><select className="select" name="domainLevel" defaultValue="2"><option value="0">0 — Sem evidência</option><option value="1">1 — Muita dificuldade</option><option value="2">2 — Parcial / orientação</option><option value="3">3 — Realiza sozinho</option><option value="4">4 — Consolidado</option></select></div>
                        <div className="field"><label>Autonomia</label><select className="select" name="autonomyLevel" defaultValue="3"><option value="0">0 — Não avaliada</option><option value="1">1 — Intervenção intensa</option><option value="2">2 — Bastante apoio</option><option value="3">3 — Apoio leve</option><option value="4">4 — Independente</option></select></div>
                        <div className="field"><label>Tipo</label><input className="input" value="Resposta aberta" readOnly /></div>
                      </div>
                      <div className="field"><label>Devolutiva / justificativa</label><textarea className="textarea" name="note" placeholder="Explique brevemente o que ficou bom e o que precisa ser revisto." /></div>
                      <button className="button button-primary" type="submit">Salvar correção</button>
                    </form>
                  );
                })}
              </section>
            );
          })}

          {(notebooks ?? []).map((assignment: any) => (
            <section className="panel" key={`notebook-${assignment.id}`}>
              <div className="panel-head"><div><div className="flex gap-8 wrap"><Badge tone="pink">{assignment.students?.preferred_name || assignment.students?.full_name || "Aluno"}</Badge><Badge tone={deliveryTone(assignment.submitted_at, assignment.due_at)}>{deliveryLabel(assignment.submitted_at, assignment.due_at)}</Badge><Badge tone="purple">Caderno Curió</Badge></div><h2>{assignment.notebook_activities?.title || "Atividade de caderno"}</h2><p>Enviado em {dt(assignment.submitted_at)}{assignment.due_at ? ` · prazo ${dt(assignment.due_at)}` : ""}</p></div></div>
              {assignment.notebook_activities?.description && <p>{assignment.notebook_activities.description}</p>}
              {assignment.submission_photo_path && <div className="asset-path">Entrega anexada: {assignment.submission_photo_path}</div>}
              <form action={reviewNotebookAssignment} className="form-stack mt-12">
                <input type="hidden" name="assignmentId" value={assignment.id}/>
                <input type="hidden" name="studentId" value={assignment.student_id}/>
                <div className="form-row"><div className="field"><label>Nota 0–100</label><input className="input" type="number" name="score" min="0" max="100" step="1" required /></div><div className="field"><label>Estrelas</label><select className="select" name="stars" defaultValue="0"><option value="0">Sem estrelas</option><option value="1">1 estrela</option><option value="2">2 estrelas</option><option value="3">3 estrelas</option><option value="4">4 estrelas</option><option value="5">5 estrelas</option></select></div></div>
                <div className="field"><label>Devolutiva para o aluno</label><textarea className="textarea" name="note" placeholder="O que foi bem feito e o que deve ser retomado. Se pedir para refazer, explique aqui exatamente o que precisa mudar." /></div>
                <label className="consent-line"><input type="checkbox" name="requestRedo" /> <span><strong>Pedir para refazer</strong> — a atividade volta para a Família/Aluno com a orientação acima e poderá ser reenviada.</span></label>
                <button className="button button-primary" type="submit">Concluir correção</button>
              </form>
            </section>
          ))}
        </div>
      ) : <EmptyState title="Nenhuma correção pendente" description="Quando um aluno enviar uma resposta aberta ou atividade de caderno, ela aparecerá aqui." />}
    </>
  );
}
