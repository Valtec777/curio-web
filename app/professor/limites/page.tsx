import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { planResourceLabel, planUsageStateLabel, planUsageTone } from "@/lib/plan-usage";

function date(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
}

export default async function TeacherPlanLimitsPage() {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil incompleto" description="A administração precisa concluir seu perfil de professor." />;

  const [{ data: links }, { data: usageRows }] = await Promise.all([
    supabase
      .from("teacher_students")
      .select("student_id,students(id,preferred_name,full_name,school_name,deleted_at,grades(name))")
      .eq("teacher_id", teacher.id)
      .eq("active", true),
    supabase.rpc("teacher_plan_consumption"),
  ]);

  const visible = (links ?? []).filter((link: any) => link.students && !link.students.deleted_at);
  const byStudent = new Map<string, any[]>();
  for (const row of usageRows ?? []) byStudent.set(row.student_id, [...(byStudent.get(row.student_id) || []), row]);

  return <>
    <PageHeader
      eyebrow="Professor • Acompanhamento"
      title="Planos e limites"
      description="Veja o que cada aluno já utilizou neste ciclo antes de agendar, enviar ou liberar um novo recurso."
    />

    <div className="notice">
      Os limites vêm do plano configurado pelo Admin. O Professor não precisa acessar valores financeiros para saber o que ainda está disponível.
    </div>

    {visible.length ? <div className="form-stack mt-16">{visible.map((link: any) => {
      const student = link.students;
      const rows = byStudent.get(link.student_id) || [];
      if (!rows.length) {
        return <article className="mission-card" key={link.student_id}>
          <div className="flex space-between gap-8 wrap"><div><strong>{student.preferred_name || student.full_name}</strong><p>{student.grades?.name || "Ano não informado"} · {student.school_name || "Escola não informada"}</p></div><Badge tone="neutral">Sem plano configurado</Badge></div>
          <p className="muted">O acompanhamento pedagógico continua visível, mas não há um ciclo comercial para calcular limites deste aluno.</p>
          <Link className="button button-secondary button-small" href={`/professor/alunos/${link.student_id}`}>Ver aluno</Link>
        </article>;
      }

      const first = rows[0];
      const warningCount = rows.filter((row: any) => ["warning", "reached", "blocked", "paused"].includes(row.usage_state)).length;
      return <article className="mission-card" key={link.student_id}>
        <div className="flex space-between gap-8 wrap">
          <div><strong>{student.preferred_name || student.full_name}</strong><p>{first.plan_name} · ciclo {date(first.cycle_start)} a {date(first.cycle_end)}</p></div>
          <div className="flex gap-8 wrap">
            <Badge tone={first.subscription_status === "active" ? "green" : first.subscription_status === "paused" ? "pink" : "yellow"}>{first.subscription_status === "active" ? "Plano ativo" : first.subscription_status === "paused" ? "Plano pausado" : "Pagamento pendente"}</Badge>
            <Badge tone={warningCount ? "yellow" : "blue"}>{warningCount ? `${warningCount} atenção` : `Renova em ${date(first.renews_on)}`}</Badge>
          </div>
        </div>

        <div className="grid-3 mt-12">{rows.map((row: any) => <div className="family-summary-card" key={row.resource_key}>
          <Badge tone={planUsageTone(row.usage_state)}>{planUsageStateLabel(row.usage_state)}</Badge>
          <h3>{!row.enabled ? "—" : row.limit_per_cycle == null ? `${row.used_units}` : `${row.used_units}/${row.limit_per_cycle}`}</h3>
          <p>{planResourceLabel(row.resource_key)}</p>
          {row.limit_per_cycle != null && row.enabled ? <small className="muted">{row.remaining_units > 0 ? `${row.remaining_units} restante(s)` : "Nenhum restante neste ciclo"}</small> : row.enabled ? <small className="muted">Uso acompanhado, sem teto configurado</small> : <small className="muted">O plano atual não inclui este recurso</small>}
        </div>)}</div>

        <div className="flex gap-8 wrap mt-16"><Link className="button button-secondary button-small" href={`/professor/alunos/${link.student_id}`}>Ver aluno</Link><Link className="button button-ghost button-small" href="/professor/agenda#novo">Ir para Agenda</Link></div>
      </article>;
    })}</div> : <EmptyState title="Nenhum aluno vinculado" description="Os limites aparecerão quando houver alunos ativos no seu acompanhamento." />}
  </>;
}
