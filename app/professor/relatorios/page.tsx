import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { createTeacherReport } from "./actions";

function one<T = any>(value: any): T | null {
  return (Array.isArray(value) ? value[0] : value) || null;
}

function date(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`));
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function reportLabel(value?: string | null) {
  if (value === "monthly") return "Resumo mensal";
  if (value === "assessment") return "Devolutiva de avaliação";
  if (value === "continuity") return "Plano de continuidade";
  return "Acompanhamento pedagógico";
}

export default async function TeacherReportsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil de professor incompleto" description="A administração precisa concluir seu vínculo de professor." />;

  const [{ data: links }, { data: reports }] = await Promise.all([
    supabase
      .from("teacher_students")
      .select("student_id,students(id,full_name,preferred_name,deleted_at,grades(name))")
      .eq("teacher_id", teacher.id)
      .eq("active", true),
    supabase
      .from("generated_reports")
      .select("id,student_id,report_type,period_start,period_end,narrative,file_path,created_at,students(full_name,preferred_name)")
      .eq("generated_by_user_id", viewer.user.id)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const students = (links ?? []).flatMap((link: any) => {
    const student: any = one(link.students);
    const grade: any = one(student?.grades);
    if (!student || student.deleted_at) return [];
    return [{ id: link.student_id, name: student.preferred_name || student.full_name || "Aluno", grade: grade?.name || "Ano não informado" }];
  });

  const reportUrls = new Map<string, string>();
  for (const report of reports ?? []) {
    if (!report.file_path) continue;
    const { data } = await supabase.storage.from("generated-documents").createSignedUrl(report.file_path, 60 * 20);
    if (data?.signedUrl) reportUrls.set(report.id, data.signedUrl);
  }

  return (
    <>
      <PageHeader
        eyebrow="Professor • Revisar"
        title="Relatórios"
        description="Registre a devolutiva pedagógica com suas próprias observações. O PLUMARELI organiza e compartilha com a família vinculada; não inventa diagnóstico nem escreve o relatório por você."
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <div><h2>Novo relatório</h2><p>Escreva apenas observações que você realmente acompanhou. O PDF é opcional.</p></div>
          </div>
          {students.length ? (
            <form action={createTeacherReport} className="form-stack">
              <div className="field">
                <label>Aluno *</label>
                <select className="select" name="studentId" defaultValue="" required>
                  <option value="" disabled>Selecionar aluno</option>
                  {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.grade}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Tipo de relatório *</label>
                <select className="select" name="reportType" defaultValue="pedagogical" required>
                  <option value="pedagogical">Acompanhamento pedagógico</option>
                  <option value="monthly">Resumo mensal</option>
                  <option value="assessment">Devolutiva de avaliação</option>
                  <option value="continuity">Plano de continuidade</option>
                </select>
              </div>
              <div className="form-row">
                <div className="field"><label>Período inicial <span className="field-optional">opcional</span></label><input className="input" type="date" name="periodStart" /></div>
                <div className="field"><label>Período final <span className="field-optional">opcional</span></label><input className="input" type="date" name="periodEnd" /></div>
              </div>
              <div className="field">
                <label>Devolutiva pedagógica *</label>
                <textarea className="textarea" name="narrative" required minLength={20} maxLength={12000} placeholder="O que foi trabalhado, o que você observou, estratégias que ajudaram, avanços, pontos que ainda precisam de prática e próximos passos." />
                <small className="muted">Evite rótulos ou conclusões clínicas. Prefira evidências observáveis e próximos passos.</small>
              </div>
              <div className="field">
                <label>PDF complementar <span className="field-optional">opcional · até 15 MB</span></label>
                <input className="input" type="file" name="file" accept="application/pdf,.pdf" />
              </div>
              <button className="button button-primary" type="submit">Publicar para a família</button>
            </form>
          ) : <EmptyState title="Nenhum aluno ativo vinculado" description="Assim que houver um aluno ativo no seu acompanhamento, ele poderá receber relatórios." />}
        </section>

        <section className="panel family-highlight">
          <div className="panel-head"><div><h2>Como o relatório funciona</h2><p>O relatório é uma saída do acompanhamento, não a fonte do diagnóstico.</p></div></div>
          <div className="form-stack">
            <div className="notice"><strong>1. Você observa.</strong><br />Use missões, caderno, avaliações, encontros e produções reais como evidência.</div>
            <div className="notice"><strong>2. Você escreve.</strong><br />A linguagem deve explicar o processo sem reduzir a criança a uma nota ou rótulo.</div>
            <div className="notice"><strong>3. A família recebe.</strong><br />O texto e o PDF, quando houver, ficam disponíveis apenas para os perfis autorizados daquele aluno.</div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><div><h2>Relatórios publicados por você</h2><p>Histórico preservado por aluno e período.</p></div></div>
        {reports?.length ? (
          <div className="form-stack">
            {reports.map((report: any) => {
              const student: any = one(report.students);
              return (
                <article className="family-upload-card" key={report.id}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <div className="flex gap-8 wrap"><Badge tone="blue">{reportLabel(report.report_type)}</Badge><Badge tone="green">Publicado</Badge></div>
                      <h3>{student?.preferred_name || student?.full_name || "Aluno"}</h3>
                      <p>{report.period_start || report.period_end ? `${date(report.period_start)} → ${date(report.period_end)}` : `Publicado em ${dateTime(report.created_at)}`}</p>
                    </div>
                    {reportUrls.get(report.id) ? <a className="button button-secondary button-small" href={reportUrls.get(report.id)} target="_blank" rel="noreferrer">Abrir PDF</a> : null}
                  </div>
                  {report.narrative ? <details className="plan-editor"><summary>Ler devolutiva</summary><p>{report.narrative}</p></details> : null}
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Nenhum relatório publicado" description="O primeiro relatório criado por você aparecerá aqui e na área da família vinculada." />}
      </section>
    </>
  );
}
