import Link from "next/link";
import { requireUser, type AppRole } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { EmptyState } from "@/components/ui";
import { NavIcon } from "@/components/nav-icon";

const environments: Record<
  AppRole,
  { title: string; description: string; href: string }
> = {
  admin: { title: "Administração", description: "Pessoas, vínculos e operação.", href: "/admin" },
  teacher: { title: "Professor", description: "Alunos, missões, correções e mapa pedagógico.", href: "/professor" },
  student: { title: "Modo Criança", description: "Missões e próximos desafios.", href: "/aluno" },
  guardian: { title: "Ninho da Família", description: "Acompanhamento dos alunos vinculados.", href: "/familia" },
};

export default async function Dashboard() {
  const viewer = await requireUser();

  return (
    <main className="site-shell section">
      <div className="flex space-between align-center wrap" style={{ marginBottom: 38 }}>
        <Logo />
        <form action={logout}><button className="button button-ghost" type="submit">Sair</button></form>
      </div>

      <div className="page-header">
        <div>
          <div className="eyebrow">Escolha o ambiente</div>
          <h1>Olá, {viewer.profile?.preferred_name || viewer.profile?.full_name || "bem-vindo"}.</h1>
          <p>Seu usuário pode acumular mais de um papel sem perder acessos.</p>
        </div>
      </div>

      {viewer.roles.length ? (
        <div className="role-grid">
          {viewer.roles.map((role) => {
            const item = environments[role];
            const href = role === "student" && viewer.roles.includes("guardian") ? "/familia/filhos" : item.href;
            const description = role === "student" && viewer.roles.includes("guardian")
              ? "Escolha a criança vinculada e abra o espaço dela com segurança."
              : item.description;
            return (
              <Link className="role-card" href={href} key={role}>
                <div>
                  <span className="dashboard-role-icon" aria-hidden="true"><NavIcon label={item.title} /></span>
                  <h3>{item.title}</h3>
                  <p>{description}</p>
                </div>
                <strong>Abrir →</strong>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Seu acesso ainda não possui um papel"
          description="Peça à administração para autorizar o ambiente apropriado."
        />
      )}
    </main>
  );
}
