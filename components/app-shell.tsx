import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { logout } from "@/app/login/actions";
import { SidebarNavLink } from "@/components/nav-link";
import { SidebarCollapseButton } from "@/components/sidebar-collapse-button";
import type { AppRole } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  requiresRole?: AppRole;
  group?: string;
};

const menus: Record<AppRole, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Hoje", group: "Visão geral" },

    { href: "/admin/matriculas", label: "Matrículas", group: "Pessoas" },
    { href: "/admin/alunos", label: "Alunos", group: "Pessoas" },
    { href: "/admin/familias", label: "Famílias", group: "Pessoas" },
    { href: "/admin/professores", label: "Professores", group: "Pessoas" },
    { href: "/admin/vinculos", label: "Vínculos", group: "Pessoas" },
    { href: "/admin/turmas", label: "Turmas", group: "Pessoas" },

    { href: "/admin/relatorios", label: "Relatórios", group: "Pedagógico" },
    { href: "/admin/ocorrencias", label: "Ocorrências", group: "Pedagógico" },
    { href: "/admin/conteudo", label: "Conteúdo", group: "Pedagógico" },
    { href: "/admin/atividades", label: "Missões e atividades", group: "Pedagógico" },
    { href: "/admin/notas", label: "Notas e avaliações", group: "Pedagógico" },
    { href: "/admin/gerador", label: "Gerador", group: "Pedagógico" },
    { href: "/admin/modelos", label: "Modelos", group: "Pedagógico" },
    { href: "/admin/cursos", label: "Cursos livres", group: "Pedagógico" },

    { href: "/admin/calendario", label: "Calendário", group: "Operação" },
    { href: "/admin/financeiro", label: "Financeiro", group: "Operação" },
    { href: "/admin/planos", label: "Planos", group: "Operação" },
    { href: "/admin/mensagens", label: "Mensagens", group: "Operação" },
    { href: "/admin/comunicacao", label: "Comunicação", group: "Operação" },
    { href: "/admin/documentos", label: "Documentos", group: "Operação" },
    { href: "/admin/suporte", label: "Suporte", group: "Operação" },

    { href: "/admin/usuarios", label: "Usuários e acessos", group: "Sistema" },
    { href: "/admin/mascotes", label: "Personagens", group: "Sistema" },
    { href: "/admin/auditoria", label: "Auditoria", group: "Sistema" },
    { href: "/admin/lixeira", label: "Lixeira", group: "Sistema" },
    { href: "/admin/configuracoes", label: "Configurações", group: "Sistema" },
  ],
  teacher: [
    { href: "/professor", label: "Hoje" },
    { href: "/professor/agenda", label: "Agenda" },
    { href: "/professor/reunioes", label: "Reuniões" },
    { href: "/professor/alunos", label: "Alunos" },
    { href: "/professor/turmas", label: "Turmas" },
    { href: "/professor/mapa", label: "Mapa Pedagógico" },
    { href: "/professor/grupos", label: "Grupos Pedagógicos" },
    { href: "/professor/missoes", label: "Missões" },
    { href: "/professor/materiais", label: "Materiais" },
    { href: "/professor/gerador", label: "Gerador" },
    { href: "/professor/conteudos", label: "Conteúdos" },
    { href: "/professor/correcoes", label: "Correções" },
    { href: "/professor/avaliacoes", label: "Avaliações" },
    { href: "/professor/mensagens", label: "Mensagens" },
    { href: "/professor/relatorios", label: "Relatórios" },
    { href: "/professor/suporte", label: "Suporte" },
    { href: "/professor/perfil", label: "Perfil" },
    { href: "/admin", label: "Área Administrativa", requiresRole: "admin" },
  ],
  student: [
    { href: "/aluno", label: "Hoje" },
    { href: "/aluno/missoes", label: "Missões" },
    { href: "/aluno/agenda", label: "Agenda" },
    { href: "/aluno/caminho", label: "Caminho" },
    { href: "/aluno/perfil", label: "Perfil" },
    { href: "/aluno/caderno", label: "Meu Caderno" },
    { href: "/aluno/conquistas", label: "Conquistas" },
    { href: "/aluno/descobertas", label: "Descobertas" },
    { href: "/aluno/modo-pensar", label: "Modo Pensar · Cursos" },
    { href: "/aluno/modo-prova", label: "Modo Prova" },
  ],
  guardian: [
    { href: "/familia", label: "Visão geral" },
    { href: "/familia/filhos", label: "Meu filho / Meus filhos" },
    { href: "/familia/conteudos", label: "Conteúdos" },
    { href: "/familia/atividades", label: "Atividades" },
    { href: "/familia/progresso", label: "Progresso" },
    { href: "/familia/avaliacoes", label: "Avaliações" },
    { href: "/familia/agenda", label: "Agenda" },
    { href: "/familia/mensagens", label: "Mensagens" },
    { href: "/familia/relatorios", label: "Relatórios" },
    { href: "/familia/plano", label: "Plano" },
    { href: "/familia/contrato", label: "Contrato" },
    { href: "/familia/pagamentos", label: "Pagamentos" },
    { href: "/familia/suporte", label: "Suporte" },
    { href: "/familia/perfil", label: "Perfil" },
    { href: "/familia/configuracoes", label: "Configurações" },
  ],
};

const titles: Record<AppRole, string> = {
  admin: "Operação CURIÓ",
  teacher: "Portal do Professor",
  student: "Explorador Curió",
  guardian: "Acompanhando",
};

const supportHref: Partial<Record<AppRole, string>> = {
  admin: "/admin/suporte",
  teacher: "/professor/suporte",
  guardian: "/familia/suporte",
};

export function AppShell({
  role,
  roles,
  name,
  subtitle,
  metricLabel,
  metricValue,
  children,
}: {
  role: AppRole;
  roles?: AppRole[];
  name?: string | null;
  subtitle?: string | null;
  metricLabel?: string | null;
  metricValue?: string | number | null;
  children: ReactNode;
}) {
  const availableRoles = roles ?? [role];
  const items = menus[role].filter(
    (item) => !item.requiresRole || availableRoles.includes(item.requiresRole),
  );
  const grouped = items.reduce<Record<string, NavItem[]>>((acc, item) => {
    const key = item.group || "";
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
  const quickSupport = supportHref[role];

  return (
    <div className={`app-frame app-frame-${role}`}>
      <aside className="sidebar">
        <div className="sidebar-brand-row">
          <Logo compact />
          <SidebarCollapseButton />
        </div>
        <div className="sidebar-role">
          <span>{titles[role]}</span>
          <strong>{name || "CURIÓ"}</strong>
          {subtitle && <small className="sidebar-subtitle">{subtitle}</small>}
          {metricLabel && (
            <div className="sidebar-metric">
              <span>{metricLabel}</span>
              <strong>{metricValue ?? 0}</strong>
            </div>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {Object.entries(grouped).map(([group, groupItems]) => (
            <div className="sidebar-nav-group" key={group || "principal"}>
              {group && <span className="sidebar-nav-title">{group}</span>}
              {groupItems.map((item) => (
                <SidebarNavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </div>
          ))}
          <div className="sidebar-nav-group sidebar-nav-utility">
            {role === "student" && availableRoles.includes("guardian") ? (
              <SidebarNavLink href="/aluno/desbloquear-familia" label="Voltar à família" />
            ) : role === "student" ? (
              availableRoles.length > 1 ? <SidebarNavLink href="/dashboard" label="Trocar ambiente" /> : null
            ) : (
              <SidebarNavLink href="/dashboard" label="Trocar ambiente" />
            )}
          </div>
        </nav>

        <form action={logout}>
          <button className="button button-ghost sidebar-logout" type="submit">
            Sair do CURIÓ
          </button>
        </form>
      </aside>

      <main className="app-main">{children}</main>

      {quickSupport && (
        <Link className="floating-support-button" href={quickSupport} aria-label="Abrir suporte do CURIÓ">
          <span aria-hidden="true">?</span>
          <strong>Suporte</strong>
        </Link>
      )}
    </div>
  );
}
