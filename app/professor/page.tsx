import Link from "next/link";
import { getCurrentTeacher } from "@/lib/teacher";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";

export default async function TeacherHome() {
  const { teacher, supabase } = await getCurrentTeacher();

  if (!teacher) {
    return (
      <EmptyState
        title="Perfil de professor ainda não vinculado"
        description="Seu usuário tem o papel teacher, mas falta criar o registro de professor. Use bootstrap_teacher conforme o README."
      />
    );
  }

  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);

  const [
    { count: students },
    { count: upcoming },
    { count: missions },
    { count: pending },
  ] = await Promise.all([
    supabase.from("teacher_students").select("student_id", { count: "exact", head: true }).eq("teacher_id", teacher.id).eq("active", true),
    supabase
      .from("agenda_events")
      .select("id", { count: "exact", head: true })
      .eq("created_by_teacher_id", teacher.id)
      .gte("starts_at", now.toISOString())
      .lte("starts_at", nextWeek.toISOString())
      .neq("status", "cancelled"),
    supabase.from("missions").select("id", { count: "exact", head: true }).eq("created_by_teacher_id", teacher.id),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Professor • Hoje"
        title="O que precisa de atenção?"
        description="Resumo operacional para chegar rápido aos alunos, correções e próximas ações."
        action={<Link className="button button-primary" href="/professor/missoes/nova">Nova Missão Cuca</Link>}
      />

      <div className="stats-grid">
        <StatCard value={students ?? 0} label="Alunos" />
        <StatCard value={upcoming ?? 0} label="Próximos encontros" />
        <StatCard value={missions ?? 0} label="Missões criadas" />
        <StatCard value={pending ?? 0} label="Correções pendentes" />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Fluxo recomendado</h2>
            <p>A estrutura de evidência já nasce separada da interface e pronta para IA revisável depois.</p>
          </div>
        </div>
        <div className="grid-3">
          <a className="mission-card" href="/professor/alunos">
            <strong>1. Observe</strong><p>Abra o mapa do aluno e veja prioridades.</p>
          </a>
          <a className="mission-card" href="/professor/missoes/nova">
            <strong>2. Intervenha</strong><p>Crie uma missão ligada a uma habilidade.</p>
          </a>
          <a className="mission-card" href="/professor/correcoes">
            <strong>3. Registre</strong><p>Corrija e transforme a resposta em evidência.</p>
          </a>
        </div>
      </section>
    </>
  );
}
