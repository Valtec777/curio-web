import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { linkGuardian, linkTeacher, moveStudentToTrash, setStudentStatus, updateStudent } from "./actions";

function studentStatusLabel(status?: string | null) {
  if (status === "paused") return "Pausado";
  if (status === "inactive") return "Encerrado";
  return "Ativo";
}

function studentStatusTone(status?: string | null): "green" | "yellow" | "neutral" {
  if (status === "paused") return "yellow";
  if (status === "inactive") return "neutral";
  return "green";
}

function shortDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Bahia" }).format(new Date(`${value}T12:00:00`));
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const allowedFilters = new Set(["all", "active", "paused", "inactive", "no_enrollment"]);
  const currentFilter = allowedFilters.has(String(params.status || "")) ? String(params.status) : "all";

  const [
    { data: students },
    { data: grades },
    { data: teachers },
    { data: guardians },
    { data: teacherLinks },
    { data: guardianLinks },
    { data: subscriptions },
  ] = await Promise.all([
    supabase.from("students").select("id,full_name,preferred_name,school_name,grade_id,status,created_at").is("deleted_at", null).order("preferred_name"),
    supabase.from("grades").select("id,name").eq("active", true).order("sort_order"),
    supabase.from("teachers").select("id,profile_id,profiles(full_name,preferred_name)").eq("active", true),
    supabase.from("guardians").select("id,profile_id,profiles(full_name,preferred_name)"),
    supabase.from("teacher_students").select("teacher_id,student_id").eq("active", true),
    supabase.from("guardian_students").select("guardian_id,student_id,relationship"),
    supabase.from("subscriptions").select("id,student_id,status,starts_at,created_at,plans(name)").order("created_at", { ascending: false }),
  ]);

  const gradeById = new Map((grades ?? []).map((grade: any) => [grade.id, grade.name]));
  const teacherById = new Map((teachers ?? []).map((teacher: any) => [teacher.id, teacher.profiles?.preferred_name || teacher.profiles?.full_name || "Professor"]));
  const guardianById = new Map((guardians ?? []).map((guardian: any) => [guardian.id, guardian.profiles?.preferred_name || guardian.profiles?.full_name || "Responsável"]));
  const subscriptionByStudent = new Map<string, any>();
  for (const subscription of subscriptions ?? []) {
    if (subscription.student_id && !subscriptionByStudent.has(subscription.student_id)) subscriptionByStudent.set(subscription.student_id, subscription);
  }

  const rows = (students ?? []).map((student: any) => {
    const teacherNames = (teacherLinks ?? []).filter((link: any) => link.student_id === student.id).map((link: any) => teacherById.get(link.teacher_id)).filter(Boolean);
    const guardianRows = (guardianLinks ?? []).filter((link: any) => link.student_id === student.id).map((link: any) => ({ name: guardianById.get(link.guardian_id), relationship: link.relationship })).filter((item: any) => item.name);
    const subscription = subscriptionByStudent.get(student.id);
    return { student, teacherNames, guardianRows, subscription };
  });

  const filteredRows = rows.filter(({ student, subscription }) => {
    if (currentFilter === "active") return student.status === "active" || student.status === "pilot";
    if (currentFilter === "paused") return student.status === "paused";
    if (currentFilter === "inactive") return student.status === "inactive";
    if (currentFilter === "no_enrollment") return !subscription;
    return true;
  });

  const totals = {
    all: rows.length,
    active: rows.filter(({ student }) => student.status === "active" || student.status === "pilot").length,
    paused: rows.filter(({ student }) => student.status === "paused").length,
    inactive: rows.filter(({ student }) => student.status === "inactive").length,
    no_enrollment: rows.filter(({ subscription }) => !subscription).length,
  };

  const filters = [
    ["all", "Todos"],
    ["active", "Ativos"],
    ["paused", "Pausados"],
    ["inactive", "Encerrados"],
    ["no_enrollment", "Sem matrícula"],
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow="Admin • Pessoas"
        title="Alunos"
        description="Lista única com ano, família, professor, plano e situação. Novos cadastros começam pela matrícula para não criar registros soltos."
        action={<Link className="button button-primary" href="/admin/matriculas#nova-matricula">+ Nova matrícula</Link>}
      />

      {params.erro && <div className="form-message form-error">{params.erro}</div>}
      {params.sucesso && <div className="form-message form-success">{params.sucesso}</div>}

      <nav className="student-filter-row" aria-label="Filtrar alunos por situação">
        {filters.map(([value, label]) => (
          <Link className={`student-filter-chip ${currentFilter === value ? "is-active" : ""}`} href={`/admin/alunos?status=${value}`} key={value}>
            {label}<span>{totals[value]}</span>
          </Link>
        ))}
      </nav>

      <section className="panel">
        <div className="panel-head">
          <div><h2>{filters.find(([value]) => value === currentFilter)?.[1] || "Todos"}</h2><p>{filteredRows.length} aluno(s) nesta visão.</p></div>
        </div>

        {filteredRows.length ? (
          <div className="student-table-wrap">
            <table className="data-table student-admin-table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Ano</th>
                  <th>Responsável</th>
                  <th>Professor</th>
                  <th>Plano</th>
                  <th>Início</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ student, teacherNames, guardianRows, subscription }) => (
                  <tr key={student.id}>
                    <td><strong>{student.preferred_name}</strong><div className="muted text-small">{student.full_name}</div></td>
                    <td>{gradeById.get(student.grade_id) || "A confirmar"}</td>
                    <td>{guardianRows.length ? guardianRows.map((guardian: any) => <div className="student-link-line" key={`${student.id}-${guardian.name}`}><strong>{guardian.name}</strong>{guardian.relationship && <small>{guardian.relationship}</small>}</div>) : <span className="muted">Sem vínculo</span>}</td>
                    <td>{teacherNames.length ? teacherNames.map((name) => <Badge key={String(name)} tone="blue">{name}</Badge>) : <span className="muted">Sem vínculo</span>}</td>
                    <td>{subscription?.plans?.name || <span className="muted">Sem plano</span>}</td>
                    <td>{shortDate(subscription?.starts_at)}</td>
                    <td><Badge tone={studentStatusTone(student.status)}>{studentStatusLabel(student.status)}</Badge></td>
                    <td>
                      <details className="record-editor student-actions-menu">
                        <summary>Ações</summary>
                        <div className="student-actions-popover">
                          <details className="plan-editor">
                            <summary>Editar aluno</summary>
                            <form action={updateStudent} className="form-stack compact-form">
                              <input type="hidden" name="studentId" value={student.id} />
                              <div className="field"><label>Nome completo</label><input className="input" name="fullName" defaultValue={student.full_name} required /></div>
                              <div className="field"><label>Nome preferido</label><input className="input" name="preferredName" defaultValue={student.preferred_name} required /></div>
                              <div className="field"><label>Ano escolar</label><select className="select" name="gradeId" defaultValue={student.grade_id || ""}><option value="">A confirmar</option>{(grades ?? []).map((grade: any) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
                              <div className="field"><label>Escola</label><input className="input" name="schoolName" defaultValue={student.school_name || ""} /></div>
                              <button className="button button-secondary button-small" type="submit">Salvar alterações</button>
                            </form>
                          </details>

                          <details className="plan-editor">
                            <summary>Vínculos</summary>
                            <div className="form-stack compact-form">
                              <form action={linkTeacher} className="form-stack"><input type="hidden" name="studentId" value={student.id} /><div className="field"><label>Professor</label><select className="select" name="teacherId" required defaultValue=""><option value="" disabled>Selecionar</option>{(teachers ?? []).map((teacher: any) => <option key={teacher.id} value={teacher.id}>{teacher.profiles?.preferred_name || teacher.profiles?.full_name || "Professor"}</option>)}</select></div><button className="button button-secondary button-small" type="submit">Vincular professor</button></form>
                              <form action={linkGuardian} className="form-stack"><input type="hidden" name="studentId" value={student.id} /><div className="field"><label>Responsável</label><select className="select" name="guardianId" required defaultValue=""><option value="" disabled>Selecionar</option>{(guardians ?? []).map((guardian: any) => <option key={guardian.id} value={guardian.id}>{guardian.profiles?.preferred_name || guardian.profiles?.full_name || "Responsável"}</option>)}</select></div><button className="button button-secondary button-small" type="submit">Vincular responsável</button></form>
                            </div>
                          </details>

                          <form action={setStudentStatus} className="status-action-row">
                            <input type="hidden" name="studentId" value={student.id} />
                            <select className="select" name="status" defaultValue={student.status === "pilot" ? "active" : student.status}>
                              <option value="active">Ativo</option>
                              <option value="paused">Pausado</option>
                              <option value="inactive">Encerrado</option>
                            </select>
                            <button className="button button-ghost button-small" type="submit">Atualizar situação</button>
                          </form>

                          <details className="plan-editor">
                            <summary className="button button-danger button-small">Excluir</summary>
                            <form action={moveStudentToTrash} className="form-stack compact-form"><input type="hidden" name="studentId" value={student.id} /><div className="field"><label>Motivo opcional</label><input className="input" name="reason" placeholder="Ex.: cadastro duplicado" /></div><p className="muted">O aluno sai da operação normal, mas vínculos e histórico ficam preservados na Lixeira.</p><button className="button button-danger button-small" type="submit">Enviar para a Lixeira</button></form>
                          </details>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Nenhum aluno nesta visão" description="Troque o filtro ou faça uma nova matrícula." />}
      </section>
    </>
  );
}
