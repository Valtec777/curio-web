import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getFamilyPortal } from "@/lib/family";

function date(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`));
}

export default async function FamilyReportsPage({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const query = await searchParams;
  const { selectedChild, supabase } = await getFamilyPortal(query.aluno || null);
  if (!selectedChild) return <EmptyState title="Nenhuma criança vinculada" description="Os relatórios aparecerão depois que houver uma criança vinculada." />;

  const { data: reports } = selectedChild.can_view_progress
    ? await supabase.from("generated_reports").select("id,report_type,period_start,period_end,narrative,file_path,created_at").eq("student_id", selectedChild.student_id).order("created_at", { ascending: false }).limit(50)
    : { data: [] as any[] };

  const urls = new Map<string, string>();
  for (const report of reports ?? []) {
    if (!report.file_path) continue;
    const { data } = await supabase.storage.from("generated-documents").createSignedUrl(report.file_path, 60 * 20);
    if (data?.signedUrl) urls.set(report.id, data.signedUrl);
  }

  return (
    <>
      <PageHeader eyebrow="Ninho da Família" title={`Relatórios de ${selectedChild.student_name}`} description="Relatórios pedagógicos disponibilizados pela equipe para a família." />
      <section className="panel">
        {reports?.length ? (
          <div className="form-stack">
            {reports.map((report: any) => (
              <article className="family-upload-card" key={report.id}>
                <div className="flex space-between gap-8 wrap">
                  <div><Badge tone="blue">Relatório</Badge><h3>{report.report_type === "pedagogical" ? "Acompanhamento pedagógico" : report.report_type}</h3><p>{report.period_start || report.period_end ? `${date(report.period_start)} → ${date(report.period_end)}` : `Disponibilizado em ${date(report.created_at)}`}</p></div>
                  {urls.get(report.id) ? <a className="button button-primary button-small" href={urls.get(report.id)} target="_blank" rel="noreferrer">Abrir relatório ↗</a> : null}
                </div>
                {report.narrative ? <p>{report.narrative}</p> : null}
              </article>
            ))}
          </div>
        ) : <EmptyState title="Nenhum relatório ainda" description="Relatórios aparecerão assim que forem disponibilizados pela equipe pedagógica." />}
      </section>
    </>
  );
}
