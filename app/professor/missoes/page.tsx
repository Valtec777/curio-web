import Link from "next/link";
import { getCurrentTeacher } from "@/lib/teacher";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { archiveMission, assignMission, removeMission, updateMission } from "./actions";
import { formatDate } from "@/lib/format";

export default async function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const params = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil incompleto" description="Falta o registro de professor." />;

  const [{ data: missions }, { data: links }] = await Promise.all([
    supabase
      .from("missions")
      .select("id, title, objective, status, estimated_minutes, created_at")
      .eq("created_by_teacher_id", teacher.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_students")
      .select("student_id, students(id, preferred_name)")
      .eq("teacher_id", teacher.id)
      .eq("active", true),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Professor"
        title="Missões Cuca"
        description="Crie como rascunho, revise e só então publique para um aluno."
        action={<Link className="button button-primary" href="/professor/missoes/nova">Nova missão</Link>}
      />

      {params.erro && <div className="form-message form-error">{params.erro}</div>}
      {params.sucesso && <div className="form-message form-success">{params.sucesso}</div>}

      {missions?.length ? (
        <div className="grid-2">
          {missions.map((mission: any) => (
            <article className="mission-card" key={mission.id}>
              <div className="flex gap-8 wrap">
                <Badge tone={mission.status === "published" ? "green" : mission.status === "archived" ? "neutral" : "yellow"}>
                  {mission.status === "published" ? "Publicada" : mission.status === "archived" ? "Arquivada" : "Rascunho"}
                </Badge>
                <Badge tone="neutral">{mission.estimated_minutes} min</Badge>
              </div>
              <h3>{mission.title}</h3>
              <p>{mission.objective}</p>
              <small className="muted">Criada em {formatDate(mission.created_at)}</small>

              <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "18px 0" }} />

              <details className="plan-editor">
                <summary>Editar missão</summary>
                <form action={updateMission} className="form-stack plan-form">
                  <input type="hidden" name="missionId" value={mission.id} />
                  <div className="field"><label>Título</label><input className="input" name="title" defaultValue={mission.title} required /></div>
                  <div className="field"><label>Objetivo</label><textarea className="textarea" name="objective" defaultValue={mission.objective} required /></div>
                  <div className="field"><label>Tempo estimado</label><input className="input" type="number" min="5" max="180" name="estimatedMinutes" defaultValue={mission.estimated_minutes} /></div>
                  <button className="button button-secondary button-small" type="submit">Salvar alterações</button>
                </form>
              </details>

              {mission.status !== "archived" && (
                <form action={assignMission} className="form-stack">
                  <input type="hidden" name="missionId" value={mission.id} />
                  <div className="form-row">
                    <div className="field">
                      <label>Publicar para</label>
                      <select className="select" name="studentId" required defaultValue="">
                        <option value="" disabled>Aluno</option>
                        {(links ?? []).map((link: any) => (
                          <option key={link.student_id} value={link.student_id}>
                            {link.students?.preferred_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Prazo</label>
                      <input className="input" name="dueAt" type="date" />
                    </div>
                  </div>
                  <button className="button button-secondary" type="submit">Revisado: publicar para o aluno</button>
                </form>
              )}

              <div className="plan-admin-actions">
                {mission.status !== "archived" && <form action={archiveMission}><input type="hidden" name="missionId" value={mission.id}/><button className="button button-ghost button-small" type="submit">Arquivar</button></form>}
                <form action={removeMission}><input type="hidden" name="missionId" value={mission.id}/><button className="button button-danger button-small" type="submit">Excluir</button></form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma missão criada" description="Crie a primeira Missão Cuca ligada a uma habilidade." />
      )}
    </>
  );
}
