import Link from "next/link";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { getCurrentStudent } from "@/lib/student";

function shortDate(value?: string | null) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Bahia" }).format(new Date(value));
}

function statusLabel(status: string) {
  if (status === "assigned") return "Não iniciada";
  if (status === "in_progress") return "Em andamento";
  if (status === "submitted") return "Enviada";
  if (status === "reviewed") return "Corrigida";
  if (status === "cancelled") return "Cancelada";
  return status;
}

function statusTone(status: string): "blue" | "pink" | "green" | "yellow" | "neutral" {
  if (status === "reviewed") return "green";
  if (status === "submitted" || status === "in_progress") return "yellow";
  if (status === "cancelled") return "neutral";
  return "blue";
}

export default async function StudentMissionsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { student, supabase } = await getCurrentStudent();
  const { data: assignments } = await supabase
    .from("mission_students")
    .select("id,status,due_at,assigned_at,progress_percent,stars_awarded,missions(title,objective,estimated_minutes,subjects(name))")
    .eq("student_id", student.id)
    .order("assigned_at", { ascending: false })
    .limit(100);

  const open = (assignments ?? []).filter((item: any) => ["assigned", "in_progress"].includes(item.status));
  const waiting = (assignments ?? []).filter((item: any) => item.status === "submitted");
  const reviewed = (assignments ?? []).filter((item: any) => item.status === "reviewed");

  return (
    <>
      <PageHeader
        eyebrow="Explorador Curió"
        title="Minhas Missões"
        description="Aqui ficam os desafios interativos do Curió: você responde na tela e envia para correção."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="stats-grid">
        <StatCard value={open.length} label="Para fazer" />
        <StatCard value={waiting.length} label="Aguardando correção" />
        <StatCard value={reviewed.length} label="Corrigidas" />
        <StatCard value={(assignments ?? []).reduce((sum: number, item: any) => sum + Number(item.stars_awarded || 0), 0)} label="Estrelas ganhas" />
      </div>

      <section className="panel mission-library-panel">
        <div className="panel-head">
          <div>
            <h2>Missões Cuca</h2>
            <p>Missão é atividade interativa. Atividade para imprimir ou fazer fora da tela fica em <strong>Meu Caderno</strong>.</p>
          </div>
          <Link className="button button-secondary button-small" href="/aluno/caderno">Abrir Meu Caderno</Link>
        </div>

        {assignments?.length ? (
          <div className="mission-list-grid">
            {assignments.map((item: any) => {
              const canOpen = ["assigned", "in_progress"].includes(item.status);
              const content = (
                <>
                  <div className="flex space-between gap-8 wrap">
                    <div className="flex gap-8 wrap">
                      <Badge tone="pink">{item.missions?.subjects?.name || "Missão Cuca"}</Badge>
                      <Badge tone="neutral">{item.missions?.estimated_minutes || 20} min</Badge>
                    </div>
                    <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                  </div>
                  <h3>{item.missions?.title || "Missão"}</h3>
                  <p>{item.missions?.objective || "Desafio Curió"}</p>
                  {item.status === "in_progress" && (
                    <div className="progress" aria-label={`Progresso ${item.progress_percent || 0}%`}>
                      <span style={{ width: `${item.progress_percent || 0}%` }} />
                    </div>
                  )}
                  <div className="mission-card-foot">
                    <small className="muted">{shortDate(item.due_at)}</small>
                    {item.stars_awarded > 0 && <Badge tone="yellow">+{item.stars_awarded} ★</Badge>}
                  </div>
                </>
              );

              return canOpen ? (
                <Link className="mission-card mission-card-clickable" href={`/aluno/missoes/${item.id}`} key={item.id}>
                  {content}
                </Link>
              ) : (
                <article className="mission-card" key={item.id}>{content}</article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Nenhuma missão por enquanto" description="Quando uma Missão Cuca for liberada para você, ela aparecerá aqui." />
        )}
      </section>
    </>
  );
}
