import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

export default async function AdminReportsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: states }, { data: reports }, { count: students }] = await Promise.all([
    supabase.from("student_skill_states").select("student_id,domain_level,evidence_count,needs_teacher_review,trend"),
    supabase.from("generated_reports").select("id,report_type,period_start,period_end,created_at,students(preferred_name,full_name)").order("created_at", { ascending: false }).limit(30),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
  ]);

  const rows = states ?? [];
  const consolidated = rows.filter((item: any) => item.evidence_count >= 2 && item.domain_level >= 3).length;
  const developing = rows.filter((item: any) => item.evidence_count >= 2 && item.domain_level < 3).length;
  const newEvidence = rows.filter((item: any) => item.evidence_count < 2).length;
  const review = rows.filter((item: any) => item.needs_teacher_review).length;
  const improving = rows.filter((item: any) => item.trend === "improving").length;
  const chart = [
    { label: "Consolidadas / com autonomia", value: consolidated },
    { label: "Em desenvolvimento", value: developing },
    { label: "Evidência ainda nova", value: newEvidence },
    { label: "Pedem revisão da professora", value: review },
  ];
  const max = Math.max(1, ...chart.map((item) => item.value));

  return (
    <>
      <PageHeader
        eyebrow="Admin • Pedagógico"
        title="Relatórios"
        description="Leitura visual do acompanhamento. As barras resumem o que existe hoje sem transformar uma criança em uma nota única."
      />

      <div className="stats-grid">
        <StatCard value={students ?? 0} label="Alunos ativos" />
        <StatCard value={rows.length} label="Estados de habilidade" />
        <StatCard value={improving} label="Evoluções recentes" />
        <StatCard value={reports?.length ?? 0} label="Relatórios recentes" />
      </div>

      <section className="panel">
        <div className="panel-head"><div><h2>Visão por barras</h2><p>Um resumo rápido, no estilo de gráfico estatístico, para ficar fácil comparar quantidades.</p></div></div>
        <div className="report-bar-chart" role="img" aria-label="Distribuição dos estados pedagógicos">
          {chart.map((item) => (
            <div className="report-bar-row" key={item.label}>
              <span>{item.label}</span>
              <div className="report-bar-track"><div className="report-bar-fill" style={{ width: `${Math.max(item.value ? 8 : 0, (item.value / max) * 100)}%` }} /></div>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Relatórios gerados</h2><p>Histórico recente dos documentos pedagógicos.</p></div></div>
        {reports?.length ? (
          <div className="form-stack">
            {reports.map((report: any) => (
              <article className="mission-card" key={report.id}>
                <div className="flex space-between gap-8 wrap">
                  <div><strong>{report.students?.preferred_name || report.students?.full_name || "Aluno"}</strong><p>{report.report_type}</p></div>
                  <Badge tone="blue">{report.period_start || "Período"} → {report.period_end || "atual"}</Badge>
                </div>
                <small className="muted">Gerado em {dt(report.created_at)}</small>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Nenhum relatório gerado" description="Os relatórios aparecerão aqui quando forem produzidos." />}
      </section>
    </>
  );
}
