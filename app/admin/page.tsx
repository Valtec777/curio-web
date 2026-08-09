import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, Badge } from "@/components/ui";

const modules = [
  { href: "/admin/relatorios", icon: "📊", title: "Relatórios Acadêmicos", text: "Desempenho e progresso geral", tone: "blue" },
  { href: "/admin/ocorrencias", icon: "📝", title: "Registro de Ocorrências", text: "Eventos e comportamentos do dia a dia", tone: "pink" },
  { href: "/admin/materiais", icon: "📚", title: "Galeria de Materiais", text: "Arquivos e recursos pedagógicos", tone: "lime" },
  { href: "/admin/mascotes", icon: "🐾", title: "Gestão de Mascotes", text: "Avatares, poses e adesivos digitais", tone: "yellow" },
  { href: "/admin/calendario", icon: "📅", title: "Calendário Escolar", text: "Eventos, encontros e prazos", tone: "blue" },
  { href: "/admin/financeiro", icon: "💳", title: "Financeiro", text: "Pagamentos, mensalidades e assinaturas", tone: "lime" },
  { href: "/admin/midia", icon: "🖼️", title: "Biblioteca de Mídia", text: "Arquivos ativos em um só lugar", tone: "pink" },
  { href: "/admin/turmas", icon: "🏫", title: "Registro de Turmas", text: "Composição e vínculos por turma", tone: "blue" },
  { href: "/admin/notas", icon: "🎯", title: "Configuração de Notas", text: "Escalas acadêmicas sem misturar diagnóstico", tone: "yellow" },
  { href: "/admin/suporte", icon: "💬", title: "Suporte e Tickets", text: "Dúvidas e solicitações", tone: "pink" },
  { href: "/admin/auditoria", icon: "🛡️", title: "Auditoria de Sistema", text: "Alterações e rastreabilidade", tone: "blue" },
  { href: "/admin/acessos", icon: "🔐", title: "Monitoramento de Acesso", text: "Histórico de entradas e saídas", tone: "lime" },
] as const;

export default async function AdminPage() {
  const supabase = await createClient();
  const [
    { count: students },
    { count: teachers },
    { count: openOccurrences },
    { count: overduePayments },
    { count: openTickets },
  ] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("teachers").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("student_occurrences").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "overdue"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting"]),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Admin Curió"
        title="Central de operação"
        description="Pessoas, aprendizagem, rotina, financeiro e segurança organizados sem perder o jeito leve e visual da marca."
        action={<Link className="button button-primary" href="/admin/matriculas">Ver matrículas</Link>}
      />

      <section className="admin-welcome-card">
        <div>
          <Badge tone="yellow">PAINEL CURIÓ</Badge>
          <h2>O que precisa de atenção hoje?</h2>
          <p>Use os módulos abaixo para acompanhar a operação. Diagnóstico pedagógico, notas acadêmicas e ocorrências continuam como conceitos separados.</p>
        </div>
        <img src="/mascotes/curio_tamandua_principal_saudando.png" alt="Tamanduá Curió" />
      </section>

      <div className="stats-grid">
        <StatCard value={students ?? 0} label="Alunos ativos" />
        <StatCard value={teachers ?? 0} label="Professores ativos" />
        <StatCard value={openOccurrences ?? 0} label="Ocorrências em acompanhamento" />
        <StatCard value={(overduePayments ?? 0) + (openTickets ?? 0)} label="Pendências operacionais" detail={`${overduePayments ?? 0} financeiras · ${openTickets ?? 0} suporte`} />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Gestão completa</h2>
            <p>Atalhos para os módulos essenciais do Admin.</p>
          </div>
        </div>
        <div className="admin-module-grid">
          {modules.map((item) => (
            <Link className={`admin-module-card module-${item.tone}`} href={item.href} key={item.href}>
              <span className="admin-module-icon">{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
              <span className="admin-module-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
