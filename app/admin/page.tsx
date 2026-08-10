import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Badge } from "@/components/ui";

export default async function AdminPage() {
  const supabase = await createClient();
  const [
    { count: students },
    { count: families },
    { count: teachers },
    { count: enrollments },
    { count: plans },
    { count: contracts },
    { count: leads },
    { count: audit },
    { data: newLeads },
    { data: enrollmentAttention },
  ] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
    supabase.from("guardians").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("teachers").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("access_invitations").select("id", { count: "exact", head: true }).eq("role", "guardian").is("deleted_at", null).not("enrollment_finalized_at", "is", null),
    supabase.from("plans").select("id", { count: "exact", head: true }).eq("active", true).is("archived_at", null).is("deleted_at", null),
    supabase.from("contracts").select("id", { count: "exact", head: true }),
    supabase.from("enrollment_requests").select("id", { count: "exact", head: true }).eq("status", "new").is("deleted_at", null),
    supabase.from("system_audit_logs").select("id", { count: "exact", head: true }),
    supabase.from("enrollment_requests").select("id,guardian_name,child_name,created_at").eq("status", "new").is("deleted_at", null).order("created_at", { ascending: false }).limit(4),
    supabase.from("access_invitations").select("id,full_name,status,student_id,created_at,students(preferred_name,full_name)").eq("role", "guardian").is("deleted_at", null).in("status", ["pending", "error"]).order("created_at", { ascending: false }).limit(4),
  ]);

  const kpis = [
    { label: "Alunos", value: students ?? 0, href: "/admin/alunos" },
    { label: "Famílias", value: families ?? 0, href: "/admin/familias" },
    { label: "Professores", value: teachers ?? 0, href: "/admin/professores" },
    { label: "Matrículas", value: enrollments ?? 0, href: "/admin/matriculas" },
    { label: "Planos", value: plans ?? 0, href: "/admin/planos" },
    { label: "Contratos", value: contracts ?? 0, href: "/admin/documentos" },
    { label: "Novos interesses", value: leads ?? 0, href: "/admin/matriculas#novos-interesses" },
    { label: "Auditoria", value: audit ?? 0, href: "/admin/auditoria" },
  ];

  const attentionCount = (newLeads?.length ?? 0) + (enrollmentAttention?.length ?? 0);

  return (
    <>
      <PageHeader
        eyebrow="Admin CURIÓ"
        title="Hoje"
        description="O essencial da operação em uma tela: pessoas, matrículas, interesses e o que precisa de atenção agora."
        action={<Link className="button button-primary" href="/admin/matriculas#nova-matricula">+ Nova matrícula</Link>}
      />

      <div className="admin-today-hero">
        <section className="admin-today-intro">
          <Badge tone="green">Visão do dia</Badge>
          <h2>Mais direto para encontrar o que você precisa.</h2>
          <p>Os módulos continuam conectados, mas o painel inicial mostra primeiro o que exige uma ação prática.</p>
          <div className="admin-quick-actions">
            <Link className="button button-primary button-small" href="/admin/matriculas#nova-matricula">Nova matrícula</Link>
            <Link className="button button-secondary button-small" href="/admin/matriculas#novos-interesses">Novos interesses</Link>
            <Link className="button button-secondary button-small" href="/admin/alunos">Alunos</Link>
            <Link className="button button-secondary button-small" href="/admin/professores">Professores</Link>
            <Link className="button button-secondary button-small" href="/admin/planos">Planos</Link>
          </div>
        </section>

        <section className="admin-attention-panel">
          <h2>Precisa de atenção</h2>
          <p>{attentionCount ? `${attentionCount} item(ns) recente(s) para conferir.` : "Nada urgente por aqui agora."}</p>
          <div className="attention-list">
            {(newLeads ?? []).map((lead: any) => (
              <div className="attention-item" key={`lead-${lead.id}`}>
                <div>
                  <strong>Novo interesse · {lead.guardian_name}</strong>
                  <small>{lead.child_name || "Criança ainda não informada"}</small>
                </div>
                <Link href={`/admin/matriculas?lead=${lead.id}#nova-matricula`}>Abrir</Link>
              </div>
            ))}
            {(enrollmentAttention ?? []).map((invite: any) => (
              <div className="attention-item" key={`invite-${invite.id}`}>
                <div>
                  <strong>{invite.status === "error" ? "Revisar matrícula" : "Matrícula em andamento"} · {invite.students?.preferred_name || invite.students?.full_name || invite.full_name}</strong>
                  <small>{invite.full_name}</small>
                </div>
                <Link href="/admin/matriculas">Abrir</Link>
              </div>
            ))}
            {!attentionCount && <div className="attention-item"><div><strong>Operação em dia</strong><small>Novos interesses e matrículas pendentes aparecerão aqui.</small></div></div>}
          </div>
        </section>
      </div>

      <section className="admin-kpi-grid" aria-label="Resumo administrativo">
        {kpis.map((item) => (
          <article className="admin-kpi-card" key={item.label}>
            <div><strong>{item.value}</strong><span>{item.label}</span></div>
            <Link href={item.href}>Abrir →</Link>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Rotina administrativa</h2>
            <p>Atalhos que não precisam ocupar o painel principal o tempo todo.</p>
          </div>
        </div>
        <div className="admin-quick-actions">
          <Link className="button button-secondary button-small" href="/admin/vinculos">Vínculos</Link>
          <Link className="button button-secondary button-small" href="/admin/turmas">Turmas</Link>
          <Link className="button button-secondary button-small" href="/admin/gerador">Gerador</Link>
          <Link className="button button-secondary button-small" href="/admin/modelos">Modelos</Link>
          <Link className="button button-secondary button-small" href="/admin/calendario">Calendário</Link>
          <Link className="button button-secondary button-small" href="/admin/financeiro">Financeiro</Link>
          <Link className="button button-secondary button-small" href="/admin/documentos">Documentos</Link>
          <Link className="button button-secondary button-small" href="/admin/lixeira">Lixeira</Link>
        </div>
      </section>
    </>
  );
}
