import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Badge } from "@/components/ui";

const growthMilestones = [
  {
    threshold: 0,
    label: "Agora",
    title: "Revisar base jurídica e privacidade",
    description: "Conferir Termos, Privacidade, Privacidade da Criança, consentimentos e contrato antes de escalar novas matrículas.",
    href: "/admin/documentos",
    action: "Abrir documentos",
  },
  {
    threshold: 5,
    label: "5 alunos",
    title: "Fazer busca da marca PLUMARELI no INPI",
    description: "Tratar a proteção do nome e da identidade como prioridade de marca. O número de alunos é só um marco interno, não um prazo legal.",
    href: "/admin/documentos",
    action: "Ver checklist",
  },
  {
    threshold: 10,
    label: "10 alunos",
    title: "Revisar formalização com contador",
    description: "Avaliar CNPJ, atividades/CNAEs, emissão de nota, tributação, conta empresarial e rotina financeira antes de crescer mais.",
    href: "/admin/financeiro",
    action: "Abrir financeiro",
  },
  {
    threshold: 20,
    label: "20 alunos",
    title: "Avaliar registro do software no INPI",
    description: "Com uma versão mais estável da plataforma, revisar titularidade do código e decidir se é o momento de registrar o programa de computador.",
    href: "/admin/auditoria",
    action: "Abrir auditoria",
  },
  {
    threshold: 30,
    label: "30 alunos",
    title: "Revisar modelo de trabalho das instrutoras",
    description: "Conferir contrato, responsabilidades, repasses, acesso a dados, rotina pedagógica e apoio profissional jurídico/contábil.",
    href: "/admin/professores",
    action: "Abrir professores",
  },
  {
    threshold: 40,
    label: "40 alunos",
    title: "Revisar segurança e acessos",
    description: "Checar permissões, backups, dados de crianças, incidentes, contas administrativas e boas práticas de segurança.",
    href: "/admin/auditoria",
    action: "Abrir auditoria",
  },
  {
    threshold: 50,
    label: "50 alunos",
    title: "Revisar preços, capacidade e estrutura",
    description: "Comparar margem, carga das instrutoras, suporte às famílias, custos de infraestrutura e capacidade antes da próxima fase.",
    href: "/admin/planos",
    action: "Abrir planos",
  },
  {
    threshold: 100,
    label: "100 alunos",
    title: "Planejar a próxima estrutura de escala",
    description: "Reavaliar regime tributário, contabilidade, suporte, segurança, infraestrutura, equipe e processos internos.",
    href: "/admin/financeiro",
    action: "Abrir financeiro",
  },
] as const;

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
    { count: contractsAwaitingSignature },
    { count: receiptsAwaitingReview },
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
    supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", "sent"),
    supabase.from("payment_receipts").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const studentCount = students ?? 0;
  const nextGrowthMilestone = growthMilestones.find((item) => item.threshold > studentCount) ?? null;

  const kpis = [
    { label: "Alunos", value: studentCount, href: "/admin/alunos" },
    { label: "Famílias", value: families ?? 0, href: "/admin/familias" },
    { label: "Professores", value: teachers ?? 0, href: "/admin/professores" },
    { label: "Matrículas", value: enrollments ?? 0, href: "/admin/matriculas" },
    { label: "Planos", value: plans ?? 0, href: "/admin/planos" },
    { label: "Contratos", value: contracts ?? 0, href: "/admin/documentos" },
    { label: "Novos interesses", value: leads ?? 0, href: "/admin/matriculas#novos-interesses" },
    { label: "Registros de atividade", value: audit ?? 0, href: "/admin/auditoria" },
  ];

  const attentionCount =
    (newLeads?.length ?? 0)
    + (enrollmentAttention?.length ?? 0)
    + (contractsAwaitingSignature ?? 0)
    + (receiptsAwaitingReview ?? 0);

  return (
    <>
      <PageHeader
        eyebrow="Admin PLUMARELI"
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
          <p>{attentionCount ? `${attentionCount} item(ns) para conferir.` : "Nada urgente por aqui agora."}</p>
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
            {(contractsAwaitingSignature ?? 0) > 0 && (
              <div className="attention-item">
                <div>
                  <strong>{contractsAwaitingSignature} contrato(s) aguardando assinatura</strong>
                  <small>A família recebeu o documento, mas a assinatura ainda não foi registrada.</small>
                </div>
                <Link href="/admin/documentos">Abrir</Link>
              </div>
            )}
            {(receiptsAwaitingReview ?? 0) > 0 && (
              <div className="attention-item">
                <div>
                  <strong>{receiptsAwaitingReview} comprovante(s) aguardando conferência</strong>
                  <small>Revise o arquivo antes de aprovar ou rejeitar o pagamento.</small>
                </div>
                <Link href="/admin/financeiro">Abrir</Link>
              </div>
            )}
            {!attentionCount && <div className="attention-item"><div><strong>Operação em dia</strong><small>Novos interesses, matrículas, contratos e comprovantes pendentes aparecerão aqui.</small></div></div>}
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
            <div className="flex gap-8 wrap">
              <Badge tone="blue">Radar de crescimento</Badge>
              <Badge tone="neutral">{studentCount} aluno(s) ativo(s)</Badge>
            </div>
            <h2 className="mt-12">O que preparar antes da próxima fase.</h2>
            <p>Estes marcos são lembretes internos da PLUMARELI. Número de alunos não cria, por si só, um prazo jurídico ou tributário: quando o assunto for legal, contábil ou trabalhista, o passo é revisar com o profissional adequado.</p>
          </div>
        </div>

        {nextGrowthMilestone ? (
          <div className="notice mb-16">
            <strong>Próximo marco: {nextGrowthMilestone.label} · {nextGrowthMilestone.title}</strong>
            <p className="mb-0">Faltam {Math.max(nextGrowthMilestone.threshold - studentCount, 0)} aluno(s) ativo(s) para este lembrete entrar na fase alcançada.</p>
          </div>
        ) : (
          <div className="notice mb-16"><strong>Todos os marcos cadastrados foram alcançados.</strong><p className="mb-0">Hora de criar a próxima etapa do radar.</p></div>
        )}

        <div className="form-stack">
          {growthMilestones.map((item) => {
            const reached = studentCount >= item.threshold;
            const isNext = nextGrowthMilestone?.threshold === item.threshold;
            return (
              <article className="mission-card" key={item.label}>
                <div className="flex space-between gap-8 wrap">
                  <div className="flex gap-8 wrap">
                    <Badge tone={reached ? "green" : isNext ? "yellow" : "neutral"}>{reached ? "Alcançado" : isNext ? "Próximo" : "Depois"}</Badge>
                    <Badge tone="blue">{item.label}</Badge>
                  </div>
                  <Link href={item.href}>{item.action} →</Link>
                </div>
                <h3 className="mt-12">{item.title}</h3>
                <p className="mb-0">{item.description}</p>
              </article>
            );
          })}
        </div>
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
