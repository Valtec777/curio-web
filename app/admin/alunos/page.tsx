import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { linkGuardian, linkTeacher, moveStudentToTrash, setStudentStatus, updateStudent } from "./actions";

const PAGE_SIZE = 20;

type StudentDirectoryRow = {
  student: any;
  teacherNames: string[];
  guardianRows: { name: string; relationship: string | null }[];
  subscription: any;
};

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

function pageNumber(value?: string) {
  const parsed = Number(value || 1);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; status?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const allowedFilters = new Set(["all", "active", "paused", "inactive", "no_enrollment"]);
  const currentFilter = allowedFilters.has(String(params.status || "")) ? String(params.status) : "all";
  const page = pageNumber(params.pagina);
  const offset = (page - 1) * PAGE_SIZE;

  const [
    { data: pageStudents },
    { data: countRows },
    { data: grades },
    { data: teachers },
    { data: guardians },
  ] = await Promise.all([
    supabase.rpc("admin_student_page", { p_status: currentFilter, p_offset: offset, p_limit: PAGE_SIZE }),
    supabase.rpc("admin_student_filter_counts"),
    supabase.from("grades").select("id,name").eq("active", true).order("sort_order"),
    supabase.from("teachers").select("id,profile_id,profiles(full_name,preferred_name)").eq("active", true),
    supabase.from("guardians").select("id,profile_id,profiles(full_name,preferred_name)"),
  ]);

  const students = (pageStudents ?? []).map((row: any) => ({
    id: row.student_id,
    full_name: row.full_name,
    preferred_name: row.preferred_name,
    school_name: row.school_name,
    grade_id: row.grade_id,
    status: row.status,
    created_at: row.created_at,
  }));
  const studentIds = students.map((student: any) => student.id);

  const [
    { data: teacherLinks },
    { data: guardianLinks },
    { data: subscriptions },
  ] = studentIds.length ? await Promise.all([
    supabase.from("teacher_students").select("teacher_id,student_id").eq("active", true).in("student_id", studentIds),
    supabase.from("guardian_students").select("guardian_id,student_id,relationship").in("student_id", studentIds),
    supabase.from("subscriptions").select("id,student_id,status,starts_at,created_at,plans(name)").in("student_id", studentIds).order("created_at", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }] as any;

  const gradeById = new Map((grades ?? []).map((grade: any) => [grade.id, grade.name]));
  const teacherById = new Map((teachers ?? []).map((teacher: any) => [teacher.id, teacher.profiles?.preferred_name || teacher.profiles?.full_name || "Professor"]));
  const guardianById = new Map((guardians ?? []).map((guardian: any) => [guardian.id, guardian.profiles?.preferred_name || guardian.profiles?.full_name || "Responsável"]));

  const teachersByStudent = new Map<string, string[]>();
  for (const link of teacherLinks ?? []) {
    const name = teacherById.get(link.teacher_id);
    if (!name) continue;
    const list = teachersByStudent.get(link.student_id) ?? [];
    list.push(String(name));
    teachersByStudent.set(link.student_id, list);
  }

  const guardiansByStudent = new Map<string, { name: string; relationship: string | null }[]>();
  for (const link of guardianLinks ?? []) {
    const name = guardianById.get(link.guardian_id);
    if (!name) continue;
    const list = guardiansByStudent.get(link.student_id) ?? [];
    list.push({ name: String(name), relationship: link.relationship || null });
    guardiansByStudent.set(link.student_id, list);
  }

  const subscriptionByStudent = new Map<string, any>();
  for (const subscription of subscriptions ?? []) {
    if (subscription.student_id && !subscriptionByStudent.has(subscription.student_id)) subscriptionByStudent.set(subscription.student_id, subscription);
  }

  const rows: StudentDirectoryRow[] = students.map((student: any) => ({
    student,
    teacherNames: teachersByStudent.get(student.id) ?? [],
    guardianRows: guardiansByStudent.get(student.id) ?? [],
    subscription: subscriptionByStudent.get(student.id),
  }));

  const counts: any = countRows?.[0] || {};
  const totals = {
    all: Number(counts.all_count || 0),
    active: Number(counts.active_count || 0),
    paused: Number(counts.paused_count || 0),
    inactive: Number(counts.inactive_count || 0),
    no_enrollment: Number(counts.no_enrollment_count || 0),
  };
  const currentTotal = totals[currentFilter as keyof typeof totals] || 0;
  const totalPages = Math.max(1, Math.ceil(currentTotal / PAGE_SIZE));

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
          <div><h2>{filters.find(([value]) => value === currentFilter)?.[1] || "Todos"}</h2><p>{currentTotal} aluno(s) nesta visão.</p></div>
        </div>

        {rows.length ? (
          <>
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
                  {rows.map(({ student, teacherNames, guardianRows, subscription }) => (
                    <tr key={student.id}>
                      <td><strong>{student.preferred_name}</strong><div className="muted text-small">{student.full_name}</div></td>
                      <td>{gradeById.get(student.grade_id) || "A confirmar"}</td>
                      <td>{guardianRows.length ? guardianRows.map((guardian) => <div className="student-link-line" key={`${student.id}-${guardian.name}`}><strong>{guardian.name}</strong>{guardian.relationship && <small>{guardian.relationship}</small>}</div>) : <span className="muted">Sem vínculo</span>}</td>
                      <td>{teacherNames.length ? teacherNames.map((name) => <Badge key={name} tone="blue">{name}</Badge>) : <span className="muted">Sem vínculo</span>}</td>
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

            {totalPages > 1 && (
              <nav className="flex gap-8 wrap align-center space-between mt-16" aria-label="Paginação de alunos">
                <small className="muted">Página {page} de {totalPages}</small>
                <div className="flex gap-8 wrap">
                  {page > 1 && <Link className="button button-secondary button-small" href={`/admin/alunos?status=${currentFilter}&pagina=${page - 1}`}>← Anterior</Link>}
                  {page < totalPages && <Link className="button button-secondary button-small" href={`/admin/alunos?status=${currentFilter}&pagina=${page + 1}`}>Próxima →</Link>}
                </div>
              </nav>
            )}
          </>
        ) : <EmptyState title="Nenhum aluno nesta visão" description="Troque o filtro ou faça uma nova matrícula." />}
      </section>
    </>
  );
}
