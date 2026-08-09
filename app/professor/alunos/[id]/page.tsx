import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { PageHeader, Badge, EmptyState } from "@/components/ui";
import {
  autonomyLabel,
  confidenceLabel,
  domainLabel,
  trendLabel,
} from "@/lib/format";

export default async function StudentMapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("teacher");
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, preferred_name, full_name, school_name")
    .eq("id", id)
    .maybeSingle();

  if (!student) notFound();

  const { data: states } = await supabase
    .from("student_skill_states")
    .select("skill_id, domain_level, autonomy_level, confidence, trend, evidence_count, updated_at, skills(name, slug)")
    .eq("student_id", id)
    .order("updated_at", { ascending: false });

  return (
    <>
      <PageHeader
        eyebrow="Mapa Pedagógico"
        title={student.preferred_name}
        description={`${student.full_name}${student.school_name ? ` • ${student.school_name}` : ""}`}
      />

      <section className="panel family-highlight">
        <div className="panel-head">
          <div>
            <h2>Leitura correta do mapa</h2>
            <p>Domínio, autonomia e confiança são dimensões separadas. Uma única evidência não fecha diagnóstico.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><h2>Habilidades observadas</h2><p>Estado atual calculado a partir do histórico preservado.</p></div>
        </div>

        {states?.length ? (
          <div className="skill-list">
            {states.map((state: any) => (
              <article className="skill-card" key={state.skill_id}>
                <div>
                  <h4>{state.skills?.name || "Habilidade"}</h4>
                  <small>{state.evidence_count} evidência(s)</small>
                </div>
                <div>
                  <small>Domínio</small><br />
                  <strong>{domainLabel(state.domain_level)}</strong>
                  <div className="domain-meter" aria-label={`Domínio ${state.domain_level} de 4`}>
                    {[1,2,3,4].map((n) => <i key={n} className={n <= state.domain_level ? "on" : ""} />)}
                  </div>
                </div>
                <div>
                  <small>Autonomia</small><br />
                  <strong>{autonomyLabel(state.autonomy_level)}</strong>
                </div>
                <div className="flex gap-8 wrap">
                  <Badge tone={state.confidence === "high" ? "green" : state.confidence === "medium" ? "yellow" : "neutral"}>
                    Confiança {confidenceLabel(state.confidence)}
                  </Badge>
                  <Badge tone={state.trend === "improving" ? "green" : state.trend === "attention" ? "pink" : "blue"}>
                    {trendLabel(state.trend)}
                  </Badge>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Ainda não há evidências suficientes"
            description="Depois que uma Missão Cuca for respondida e corrigida, as habilidades começam a aparecer aqui."
          />
        )}
      </section>
    </>
  );
}
