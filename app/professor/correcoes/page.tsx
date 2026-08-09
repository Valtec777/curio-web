import { getCurrentTeacher } from "@/lib/teacher";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { reviewAnswer } from "./actions";
import { formatDate } from "@/lib/format";

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const params = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil incompleto" description="Falta o registro de professor." />;

  const { data: submissions } = await supabase
    .from("submissions")
    .select(`
      id,
      student_id,
      submitted_at,
      review_status,
      students(preferred_name),
      mission_students(mission_id, missions(title)),
      answers(
        id,
        answer_text,
        score,
        reviewed_at,
        question_id,
        mission_questions(id, prompt, primary_skill_id, skills(name))
      )
    `)
    .eq("review_status", "pending")
    .order("submitted_at", { ascending: true });

  return (
    <>
      <PageHeader
        eyebrow="Professor"
        title="Correções"
        description="A correção humana transforma uma resposta em evidência pedagógica. O sistema não publica um diagnóstico sozinho."
      />

      {params.erro && <div className="form-message form-error">{params.erro}</div>}
      {params.sucesso && <div className="form-message form-success">{params.sucesso}</div>}

      {submissions?.length ? (
        <div className="form-stack">
          {submissions.map((submission: any) => (
            <section className="panel" key={submission.id}>
              <div className="panel-head">
                <div>
                  <div className="flex gap-8 wrap">
                    <Badge tone="pink">{submission.students?.preferred_name || "Aluno"}</Badge>
                    <Badge tone="yellow">Pendente</Badge>
                  </div>
                  <h2>{submission.mission_students?.missions?.title || "Missão"}</h2>
                  <p>Enviada em {formatDate(submission.submitted_at)}</p>
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

                    <div className="review-answer">
                      <strong>Resposta da criança</strong>
                      <p className="mb-0">{answer.answer_text || "Sem resposta textual."}</p>
                    </div>

                    <div className="grid-3">
                      <div className="field">
                        <label>Domínio</label>
                        <select className="select" name="domainLevel" defaultValue="2">
                          <option value="0">0 — Sem evidência suficiente</option>
                          <option value="1">1 — Muita dificuldade</option>
                          <option value="2">2 — Parcial / orientação</option>
                          <option value="3">3 — Realiza sozinho</option>
                          <option value="4">4 — Consolidado</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Autonomia</label>
                        <select className="select" name="autonomyLevel" defaultValue="3">
                          <option value="0">0 — Não avaliada</option>
                          <option value="1">1 — Intervenção intensa</option>
                          <option value="2">2 — Bastante apoio</option>
                          <option value="3">3 — Apoio leve</option>
                          <option value="4">4 — Independente</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Score 0–1</label>
                        <input className="input" type="number" name="score" min="0" max="1" step="0.1" defaultValue="0.7" />
                      </div>
                    </div>

                    <div className="field">
                      <label>Observação objetiva</label>
                      <textarea
                        className="textarea"
                        name="note"
                        placeholder="Registre evidência e contexto, sem rótulos."
                      />
                    </div>

                    <button className="button button-primary" type="submit">
                      Registrar evidência
                    </button>
                  </form>
                );
              })}
            </section>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma correção pendente" description="Quando um aluno enviar uma missão, ela aparecerá aqui." />
      )}
    </>
  );
}
