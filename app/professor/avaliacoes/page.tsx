import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { MultiStudentPicker } from "@/components/multi-student-picker";
import { getCurrentTeacher } from "@/lib/teacher";
import { removeTeacherResource, setTeacherResourceStatus, updateTeacherResource } from "@/app/professor/manage-actions";
import { assignTeacherAssessment, duplicateTeacherAssessment } from "./actions";
import { gradeTeacherAssessment } from "./grade-actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

export default async function TeacherAssessmentsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return null;

  const [{ data: assessments }, { data: studentLinks }] = await Promise.all([
    supabase
      .from("assessments")
      .select("id,title,instructions,scheduled_for,status,file_path,created_at,subjects(name),grades(name),grading_schemes(name,scale_min,scale_max),assessment_students(id,student_id,status,score,submitted_at,reviewed_at,students(preferred_name,full_name))")
      .eq("created_by_teacher_id", teacher.id)
      .order("scheduled_for", { ascending: false, nullsFirst: false })
      .limit(80),
    supabase.from("teacher_students").select("student_id,students(preferred_name,full_name,school_name,grades(name))").eq("teacher_id", teacher.id).eq("active", true),
  ]);

  const students = (studentLinks ?? []).filter((link: any) => link.students).map((link: any) => ({
    id: link.student_id,
    name: link.students.preferred_name || link.students.full_name || "Aluno",
    detail: link.students.grades?.name || link.students.school_name || "",
  }));

  const fileRows = (assessments ?? []).filter((item: any) => item.file_path);
  const signedRows = await Promise.all(fileRows.map(async (item: any) => {
    const { data } = await supabase.storage.from("teacher-materials").createSignedUrl(item.file_path, 60 * 30);
    return [item.id, data?.signedUrl || ""] as const;
  }));
  const signedUrls = new Map(signedRows);

  return (
    <>
      <PageHeader
        eyebrow="Professor • Criar e publicar"
        title="Avaliações"
        description="Crie avaliações para alunos selecionados e acompanhe entrega, revisão e nota usando a escala definida no CURIÓ."
        action={<Link className="button button-primary" href="/professor/avaliacoes/nova">+ Nova avaliação</Link>}
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="panel">
        {(assessments ?? []).length ? (
          <div className="teacher-resource-list">
            {(assessments ?? []).map((assessment: any) => {
              const assignments = assessment.assessment_students ?? [];
              const assignedIds = assignments.map((item: any) => item.student_id);
              const fileUrl = signedUrls.get(assessment.id) || "";
              return (
                <article className="teacher-resource-card" id={`avaliacao-${assessment.id}`} key={assessment.id}>
                  <div className="teacher-resource-top">
                    <div>
                      <div className="flex gap-8 wrap">
                        <Badge tone={assessment.status === "published" ? "green" : assessment.status === "archived" ? "neutral" : "yellow"}>{assessment.status === "published" ? "Publicada" : assessment.status === "archived" ? "Arquivada" : "Rascunho"}</Badge>
                        {assessment.subjects?.name && <Badge tone="blue">{assessment.subjects.name}</Badge>}
                        {assessment.grades?.name && <Badge tone="purple">{assessment.grades.name}</Badge>}
                      </div>
                      <h3>{assessment.title}</h3>
                      <p>{assessment.instructions || "Sem observações adicionais."}</p>
                    </div>
                    {fileUrl && <a className="button button-secondary button-small" href={fileUrl} target="_blank" rel="noreferrer">Abrir arquivo ↗</a>}
                  </div>

                  <div className="teacher-resource-meta">
                    <span>Data: {dt(assessment.scheduled_for)}</span>
                    <span>• {assignments.length} aluno(s)</span>
                    {assessment.grading_schemes?.name && <span>• Escala: {assessment.grading_schemes.name} ({assessment.grading_schemes.scale_min}–{assessment.grading_schemes.scale_max})</span>}
                  </div>

                  {assignments.length > 0 && (
                    <div className="teacher-resource-list">
                      {assignments.map((assignment: any) => (
                        <div className="teacher-recent-item" key={assignment.id}>
                          <div>
                            <strong>{assignment.students?.preferred_name || assignment.students?.full_name || "Aluno"}</strong>
                            <small>{assignment.submitted_at ? `Entregue em ${dt(assignment.submitted_at)}` : assignment.status === "assigned" ? "Aguardando aluno" : assignment.status}</small>
                          </div>
                          <div className="flex gap-8 wrap">
                            {assignment.score != null && <Badge tone="green">Nota {assignment.score}</Badge>}
                            <form action={gradeTeacherAssessment} className="flex gap-8 wrap">
                              <input type="hidden" name="assignmentId" value={assignment.id}/>
                              <input type="hidden" name="studentId" value={assignment.student_id}/>
                              <input className="input" style={{ width: 90 }} type="number" name="score" min="0" max="100" step="1" defaultValue={assignment.score ?? ""} placeholder="0–100" aria-label={`Nota de ${assignment.students?.preferred_name || "aluno"}`} required />
                              <button className="button button-secondary button-small" type="submit">Salvar nota</button>
                            </form>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <details className="plan-editor">
                    <summary>Enviar para outros alunos</summary>
                    <form action={assignTeacherAssessment} className="form-stack compact-form">
                      <input type="hidden" name="assessmentId" value={assessment.id} />
                      <MultiStudentPicker students={students} defaultSelected={assignedIds} />
                      <button className="button button-primary button-small" type="submit">Enviar aos selecionados</button>
                    </form>
                  </details>

                  <details className="plan-editor">
                    <summary>Editar avaliação</summary>
                    <form action={updateTeacherResource} className="form-stack compact-form">
                      <input type="hidden" name="kind" value="assessment" />
                      <input type="hidden" name="id" value={assessment.id} />
                      <div className="field"><label>Título</label><input className="input" name="title" defaultValue={assessment.title} required /></div>
                      <div className="field"><label>Conteúdo / observação</label><textarea className="textarea" name="description" defaultValue={assessment.instructions || ""} /></div>
                      <button className="button button-secondary button-small" type="submit">Salvar alterações</button>
                    </form>
                  </details>

                  <div className="teacher-resource-actions">
                    <form action={duplicateTeacherAssessment}><input type="hidden" name="assessmentId" value={assessment.id}/><button className="button button-secondary button-small" type="submit">Duplicar</button></form>
                    {assessment.status !== "archived" && <form action={setTeacherResourceStatus}><input type="hidden" name="kind" value="assessment"/><input type="hidden" name="id" value={assessment.id}/><input type="hidden" name="status" value="archived"/><button className="button button-ghost button-small" type="submit">Arquivar</button></form>}
                    <form action={removeTeacherResource}><input type="hidden" name="kind" value="assessment"/><input type="hidden" name="id" value={assessment.id}/><button className="button button-danger button-small" type="submit">Excluir</button></form>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Nenhuma avaliação criada" description="Crie a primeira avaliação pelo botão acima." />}
      </section>
    </>
  );
}
