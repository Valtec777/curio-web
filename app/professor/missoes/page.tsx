import Link from "next/link";
import { getCurrentTeacher } from "@/lib/teacher";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { MultiStudentPicker } from "@/components/multi-student-picker";
import { archiveMission, assignMissionMany, duplicateMission, removeMission, updateMission } from "./actions";
import { formatDate } from "@/lib/format";

function statusLabel(status?: string | null) {
  if (status === "published") return "Ativa";
  if (status === "archived") return "Arquivada";
  return "Rascunho";
}

export default async function MissionsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const params = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil incompleto" description="Falta o registro de professor." />;

  const [{ data: missions }, { data: links }] = await Promise.all([
    supabase
      .from("missions")
      .select("id,title,objective,description,status,estimated_minutes,created_at,subjects(name),grades(name),characters(name),mission_students(student_id,due_at,status,students(preferred_name,full_name)),mission_questions(id,position,prompt,question_type,options,mission_question_answer_keys(correct_value))")
      .eq("created_by_teacher_id", teacher.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_students")
      .select("student_id,students(id,preferred_name,full_name,school_name,grades(name))")
      .eq("teacher_id", teacher.id)
      .eq("active", true),
  ]);

  const students = (links ?? []).filter((link: any) => link.students).map((link: any) => ({
    id: link.student_id,
    name: link.students.preferred_name || link.students.full_name || "Aluno",
    detail: link.students.grades?.name || link.students.school_name || "",
  }));

  return (
    <>
      <PageHeader
        eyebrow="Professor • Criar e publicar"
        title="Missões"
        description="Crie, atribua e acompanhe suas Missões Cuca. Uma mesma missão pode ser enviada para vários alunos."
        action={<Link className="button button-primary" href="/professor/missoes/nova">+ Nova missão</Link>}
      />

      {params.erro && <div className="form-message form-error">{params.erro}</div>}
      {params.sucesso && <div className="form-message form-success">{params.sucesso}</div>}

      {missions?.length ? (
        <div className="teacher-resource-list">
          {missions.map((mission: any) => {
            const assignments = mission.mission_students ?? [];
            const assignedIds = assignments.map((item: any) => item.student_id);
            const names = assignments.map((item: any) => item.students?.preferred_name || item.students?.full_name).filter(Boolean);
            const questions = [...(mission.mission_questions ?? [])].sort((a: any, b: any) => Number(a.position || 0) - Number(b.position || 0));
            return (
              <article className="teacher-resource-card" id={`missao-${mission.id}`} key={mission.id}>
                <div className="teacher-resource-top">
                  <div>
                    <div className="flex gap-8 wrap">
                      <Badge tone={mission.status === "published" ? "green" : mission.status === "archived" ? "neutral" : "yellow"}>{statusLabel(mission.status)}</Badge>
                      <Badge tone="blue">{mission.subjects?.name || "Sem matéria"}</Badge>
                      {mission.grades?.name && <Badge tone="purple">{mission.grades.name}</Badge>}
                      <Badge tone="neutral">{mission.estimated_minutes} min</Badge>
                    </div>
                    <h3>{mission.title}</h3>
                    <p>{mission.description || mission.objective}</p>
                  </div>
                  <small className="muted">Criada em {formatDate(mission.created_at)}</small>
                </div>

                <div className="teacher-resource-meta">
                  <span><strong>Objetivo:</strong> {mission.objective}</span>
                  {mission.characters?.name && <span>• Mascote: {mission.characters.name}</span>}
                  <span>• {assignments.length} atribuição(ões)</span>
                  <span>• {questions.length} questão(ões)</span>
                </div>

                {names.length > 0 && <div className="flex gap-8 wrap"><small className="muted">Enviada para:</small>{names.map((name: string, index: number) => <Badge tone="blue" key={`${name}-${index}`}>{name}</Badge>)}</div>}

                {questions.length > 0 && (
                  <details className="plan-editor">
                    <summary>Ver questões e gabarito</summary>
                    <div className="form-stack compact-form">
                      {questions.map((question: any, index: number) => {
                        const options = Array.isArray(question.options) ? question.options : [];
                        const correct = question.mission_question_answer_keys?.correct_value;
                        return <div className="question-box" key={question.id}>
                          <small className="eyebrow">Questão {index + 1}</small>
                          <strong>{question.prompt}</strong>
                          {options.length > 0 && <div className="form-stack compact-form mt-12">{options.map((option: string, optionIndex: number) => <div className="flex gap-8" key={`${question.id}-${optionIndex}`}><Badge tone={correct === option ? "green" : "neutral"}>{String.fromCharCode(65 + optionIndex)}</Badge><span>{option}</span>{correct === option && <strong>✓ correta</strong>}</div>)}</div>}
                          {question.question_type === "open_text" ? <Badge tone="yellow">Correção humana</Badge> : correct ? <div className="teacher-answer-key"><strong>Gabarito:</strong> {correct}</div> : <Badge tone="yellow">Gabarito não informado</Badge>}
                        </div>;
                      })}
                    </div>
                  </details>
                )}

                <details className="plan-editor">
                  <summary>Enviar / atualizar alunos</summary>
                  <form action={assignMissionMany} className="form-stack compact-form">
                    <input type="hidden" name="missionId" value={mission.id} />
                    <MultiStudentPicker students={students} defaultSelected={assignedIds} />
                    <div className="field"><label>Prazo</label><input className="input" name="dueAt" type="date" /></div>
                    <button className="button button-primary button-small" type="submit">Publicar para selecionados</button>
                  </form>
                </details>

                <details className="plan-editor">
                  <summary>Editar missão</summary>
                  <form action={updateMission} className="form-stack compact-form">
                    <input type="hidden" name="missionId" value={mission.id} />
                    <div className="field"><label>Título</label><input className="input" name="title" defaultValue={mission.title} required /></div>
                    <div className="field"><label>Objetivo</label><textarea className="textarea" name="objective" defaultValue={mission.objective} required /></div>
                    <div className="field"><label>Descrição</label><textarea className="textarea textarea-compact" name="description" defaultValue={mission.description || ""} /></div>
                    <div className="field"><label>Tempo estimado</label><input className="input" type="number" min="5" max="180" name="estimatedMinutes" defaultValue={mission.estimated_minutes} /></div>
                    <button className="button button-secondary button-small" type="submit">Salvar alterações</button>
                  </form>
                </details>

                <div className="teacher-resource-actions">
                  <form action={duplicateMission}><input type="hidden" name="missionId" value={mission.id} /><button className="button button-secondary button-small" type="submit">Duplicar</button></form>
                  {mission.status !== "archived" && <form action={archiveMission}><input type="hidden" name="missionId" value={mission.id}/><button className="button button-ghost button-small" type="submit">Arquivar</button></form>}
                  <form action={removeMission}><input type="hidden" name="missionId" value={mission.id}/><button className="button button-danger button-small" type="submit">Excluir</button></form>
                </div>
              </article>
            );
          })}
        </div>
      ) : <EmptyState title="Nenhuma missão criada" description="Crie sua primeira Missão Cuca pelo botão acima." />}
    </>
  );
}
