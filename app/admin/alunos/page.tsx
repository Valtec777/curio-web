import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { createStudent, linkGuardian, linkTeacher, moveStudentToTrash, setStudentStatus, updateStudent } from "./actions";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [
    { data: students },
    { data: grades },
    { data: teachers },
    { data: guardians },
    { data: teacherLinks },
    { data: guardianLinks },
  ] = await Promise.all([
    supabase.from("students").select("id, full_name, preferred_name, school_name, grade_id, status").is("deleted_at", null).order("preferred_name"),
    supabase.from("grades").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("teachers").select("id, profile_id, profiles(full_name, preferred_name)").eq("active", true),
    supabase.from("guardians").select("id, profile_id, profiles(full_name, preferred_name)"),
    supabase.from("teacher_students").select("teacher_id, student_id").eq("active", true),
    supabase.from("guardian_students").select("guardian_id, student_id"),
  ]);

  const teacherById = new Map((teachers ?? []).map((t: any) => [
    t.id,
    t.profiles?.preferred_name || t.profiles?.full_name || "Professor",
  ]));
  const guardianById = new Map((guardians ?? []).map((g: any) => [
    g.id,
    g.profiles?.preferred_name || g.profiles?.full_name || "Responsável",
  ]));

  return (
    <>
      <PageHeader
        eyebrow="Admin • Pessoas"
        title="Alunos e vínculos"
        description="Cadastre a criança uma única vez, edite sem recriar e preserve vínculos ao excluir."
      />

      {params.erro && <div className="form-message form-error">{params.erro}</div>}
      {params.sucesso && <div className="form-message form-success">{params.sucesso}</div>}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Novo aluno</h2>
              <p>Dados mínimos para iniciar o acompanhamento.</p>
            </div>
          </div>

          <form action={createStudent} className="form-stack">
            <div className="form-row">
              <div className="field">
                <label>Nome completo</label>
                <input className="input" name="fullName" required />
              </div>
              <div className="field">
                <label>Nome preferido</label>
                <input className="input" name="preferredName" required />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Ano escolar</label>
                <select className="select" name="gradeId" defaultValue="">
                  <option value="">A confirmar</option>
                  {(grades ?? []).map((grade) => (
                    <option key={grade.id} value={grade.id}>{grade.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Escola</label>
                <input className="input" name="schoolName" />
              </div>
            </div>

            <button className="button button-primary" type="submit">Criar aluno</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Regra de vínculo e exclusão</h2>
              <p>Quem não está vinculado não deve enxergar o aluno.</p>
            </div>
          </div>
          <div className="notice">
            Excluir envia o aluno para a Lixeira por soft delete. O ID, vínculos, missões, avaliações e histórico não são apagados automaticamente.
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Alunos cadastrados</h2>
            <p>{students?.length ?? 0} registro(s) operacional(is).</p>
          </div>
        </div>

        {students?.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Escola</th>
                  <th>Professor</th>
                  <th>Família</th>
                  <th>Vínculos</th>
                  <th>Gestão</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const teacherNames = (teacherLinks ?? [])
                    .filter((link) => link.student_id === student.id)
                    .map((link) => teacherById.get(link.teacher_id))
                    .filter(Boolean);
                  const guardianNames = (guardianLinks ?? [])
                    .filter((link) => link.student_id === student.id)
                    .map((link) => guardianById.get(link.guardian_id))
                    .filter(Boolean);

                  return (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.preferred_name}</strong>
                        <div className="muted text-small">{student.full_name}</div>
                      </td>
                      <td>{student.school_name || "A confirmar"}</td>
                      <td>
                        {teacherNames.length
                          ? teacherNames.map((name) => <Badge key={String(name)} tone="blue">{name}</Badge>)
                          : <span className="muted">Sem vínculo</span>}
                      </td>
                      <td>
                        {guardianNames.length
                          ? guardianNames.map((name) => <Badge key={String(name)} tone="pink">{name}</Badge>)
                          : <span className="muted">Sem vínculo</span>}
                      </td>
                      <td>
                        <div className="form-stack">
                          <form action={linkTeacher} className="flex gap-8">
                            <input type="hidden" name="studentId" value={student.id} />
                            <select className="select" name="teacherId" required defaultValue="">
                              <option value="" disabled>Professor</option>
                              {(teachers ?? []).map((teacher: any) => (
                                <option key={teacher.id} value={teacher.id}>
                                  {teacher.profiles?.preferred_name || teacher.profiles?.full_name || "Professor"}
                                </option>
                              ))}
                            </select>
                            <button className="button button-small button-secondary" type="submit">Vincular</button>
                          </form>

                          <form action={linkGuardian} className="flex gap-8">
                            <input type="hidden" name="studentId" value={student.id} />
                            <select className="select" name="guardianId" required defaultValue="">
                              <option value="" disabled>Responsável</option>
                              {(guardians ?? []).map((guardian: any) => (
                                <option key={guardian.id} value={guardian.id}>
                                  {guardian.profiles?.preferred_name || guardian.profiles?.full_name || "Responsável"}
                                </option>
                              ))}
                            </select>
                            <button className="button button-small button-secondary" type="submit">Vincular</button>
                          </form>
                        </div>
                      </td>
                      <td>
                        <div className="student-admin-actions">
                          <Badge tone={student.status === "active" ? "green" : student.status === "paused" ? "yellow" : "neutral"}>{student.status}</Badge>
                          <details className="plan-editor">
                            <summary>Editar</summary>
                            <form action={updateStudent} className="form-stack compact-form">
                              <input type="hidden" name="studentId" value={student.id} />
                              <div className="field"><label>Nome completo</label><input className="input" name="fullName" defaultValue={student.full_name} required /></div>
                              <div className="field"><label>Nome preferido</label><input className="input" name="preferredName" defaultValue={student.preferred_name} required /></div>
                              <div className="field"><label>Ano escolar</label><select className="select" name="gradeId" defaultValue={student.grade_id || ""}><option value="">A confirmar</option>{(grades ?? []).map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
                              <div className="field"><label>Escola</label><input className="input" name="schoolName" defaultValue={student.school_name || ""} /></div>
                              <button className="button button-secondary button-small" type="submit">Salvar alterações</button>
                            </form>
                          </details>
                          <form action={setStudentStatus}>
                            <input type="hidden" name="studentId" value={student.id} />
                            <input type="hidden" name="status" value={student.status === "active" ? "inactive" : "active"} />
                            <button className={`button button-small ${student.status === "active" ? "button-ghost" : "button-primary"}`} type="submit">{student.status === "active" ? "Desativar" : "Reativar"}</button>
                          </form>
                          <details className="plan-editor">
                            <summary className="button button-danger button-small">Excluir</summary>
                            <form action={moveStudentToTrash} className="form-stack compact-form">
                              <input type="hidden" name="studentId" value={student.id} />
                              <div className="field">
                                <label>Motivo opcional</label>
                                <input className="input" name="reason" placeholder="Ex.: cadastro duplicado" />
                              </div>
                              <p className="muted">O aluno sairá da operação normal, mas seu histórico será preservado e poderá ser restaurado pela Lixeira.</p>
                              <button className="button button-danger button-small" type="submit">Enviar para a Lixeira</button>
                            </form>
                          </details>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nenhum aluno ainda" description="Crie o primeiro aluno usando o formulário acima." />
        )}
      </section>
    </>
  );
}
