import { notFound } from "next/navigation";
import { getCurrentStudent } from "@/lib/student";
import { Badge } from "@/components/ui";
import { submitMission } from "./actions";

export default async function StudentMissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { student, supabase } = await getCurrentStudent();
  if (!student) notFound();

  const { data: assignment } = await supabase
    .from("mission_students")
    .select("id, mission_id, status, missions(title, objective, estimated_minutes)")
    .eq("id", id)
    .eq("student_id", student.id)
    .maybeSingle();

  if (!assignment) notFound();

  const { data: questions } = await supabase
    .from("mission_questions")
    .select("id, prompt, hint, position, question_type, options")
    .eq("mission_id", assignment.mission_id)
    .order("position");

  return (
    <>
      <section className="kid-hero">
        <div className="flex gap-8 wrap">
          <Badge tone="pink">Missão Cuca</Badge>
          <Badge tone="neutral">{(assignment as any).missions?.estimated_minutes || 20} min</Badge>
        </div>
        <h1 data-audio-instruction>{(assignment as any).missions?.title}</h1>
        <p data-audio-instruction>{(assignment as any).missions?.objective}</p>
      </section>

      {query.erro && <div className="form-message form-error">{query.erro}</div>}

      <form action={submitMission}>
        <input type="hidden" name="missionStudentId" value={assignment.id} />

        <section className="panel family-highlight">
          <div className="eyebrow">1. Primeiro, vamos entender</div>
          <h2 data-audio-instruction>Leia com calma. Depois tente explicar do seu jeito.</h2>
          <p className="muted" data-audio-instruction>Você não precisa responder rápido. Pensar faz parte da missão.</p>
        </section>

        {(questions ?? []).map((question, index) => (
          <section className="question-box" key={question.id}>
            <div className="eyebrow">{index + 2}. Agora é sua vez</div>
            <h3 data-audio-instruction>{question.prompt}</h3>
            {question.hint && (
              <details className="notice" style={{ marginBottom: 14 }}>
                <summary><strong>Preciso de uma pista</strong></summary>
                <p data-audio-instruction>{question.hint}</p>
              </details>
            )}
            {(["multiple_choice", "true_false"].includes((question as any).question_type) && Array.isArray((question as any).options) && (question as any).options.length) ? (
              <div className="quiz-options" role="radiogroup" aria-label={`Alternativas da questão ${index + 1}`}>
                {(question as any).options.map((option: string) => (
                  <label className="quiz-option" key={option}>
                    <input type="radio" name={`answer_${question.id}`} value={option} required />
                    <span data-audio-instruction>{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="textarea"
                name={`answer_${question.id}`}
                placeholder="Escreva com suas palavras..."
                required
              />
            )}
          </section>
        ))}

        <button className="button button-primary button-block" type="submit">
          Terminei — enviar para o professor
        </button>
      </form>
    </>
  );
}
