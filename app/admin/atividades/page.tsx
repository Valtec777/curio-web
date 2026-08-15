import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setAdminContentStatus, updateAdminContentItem } from "@/app/admin/actions";
import { moveAdminContentToTrash } from "./actions";

function tone(status?: string | null): "green" | "yellow" | "pink" | "blue" | "neutral" {
  if (["active", "paid", "completed", "approved", "signed", "published"].includes(status || "")) return "green";
  if (["new", "pending", "draft", "processing", "scheduled"].includes(status || "")) return "yellow";
  if (["failed", "overdue", "cancelled", "rejected"].includes(status || "")) return "pink";
  if (status === "archived") return "neutral";
  return "blue";
}

export default async function AdminActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();

  const [
    { data: trash },
    { data: missions },
    { data: materials },
    { data: notebooks },
    { data: assessments },
  ] = await Promise.all([
    supabase
      .from("trash_items")
      .select("entity_type,entity_id")
      .in("entity_type", ["missions", "materials", "notebook_activities", "assessments"])
      .is("restored_at", null),
    supabase
      .from("missions")
      .select("id,title,objective,status,updated_at,teachers(profiles(full_name,preferred_name))")
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase
      .from("materials")
      .select("id,title,description,status,material_type,updated_at,teachers(profiles(full_name,preferred_name))")
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase
      .from("notebook_activities")
      .select("id,title,description,status,updated_at,teachers(profiles(full_name,preferred_name))")
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase
      .from("assessments")
      .select("id,title,instructions,status,updated_at,teachers(profiles(full_name,preferred_name))")
      .order("updated_at", { ascending: false })
      .limit(80),
  ]);

  const removed = new Set((trash ?? []).map((item: any) => `${item.entity_type}:${item.entity_id}`));
  const visible = (entityType: string, items: any[] | null) =>
    (items ?? []).filter((item: any) => !removed.has(`${entityType}:${item.id}`)).slice(0, 40);

  const groups = [
    { kind: "mission", entityType: "missions", title: "Missões Cuca", items: visible("missions", missions ?? []), descriptionKey: "objective" },
    { kind: "notebook", entityType: "notebook_activities", title: "Caderno Plumareli", items: visible("notebook_activities", notebooks ?? []), descriptionKey: "description" },
    { kind: "material", entityType: "materials", title: "Materiais", items: visible("materials", materials ?? []), descriptionKey: "description" },
    { kind: "assessment", entityType: "assessments", title: "Avaliações", items: visible("assessments", assessments ?? []), descriptionKey: "instructions" },
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow="Operação PLUMARELI"
        title="Missões e atividades"
        description="Edite, arquive ou exclua conteúdos sem apagar evidências e vínculos pedagógicos existentes."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="notice">
        Arquivar e excluir são ações diferentes. Arquivar mantém o item nesta gestão; excluir retira da operação e envia para a Lixeira. A exclusão permanente permanece bloqueada enquanto houver risco de apagar histórico pedagógico.
      </div>

      {groups.map((group) => (
        <section className="panel" key={group.kind}>
          <div className="panel-head">
            <div>
              <h2>{group.title}</h2>
              <p>{group.items.length} item(ns) operacional(is) recente(s)</p>
            </div>
          </div>

          {group.items.length ? (
            <div className="grid-3">
              {group.items.map((item: any) => {
                const description = item[group.descriptionKey];
                return (
                  <article className="mission-card" key={`${group.kind}-${item.id}`}>
                    <div className="flex space-between gap-8 wrap">
                      <Badge tone={tone(item.status)}>{item.status}</Badge>
                      <small className="muted">
                        {item.teachers?.profiles?.preferred_name || item.teachers?.profiles?.full_name || "Equipe Plumareli"}
                      </small>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{description || "Sem descrição"}</p>

                    <details className="plan-editor">
                      <summary>Editar</summary>
                      <form action={updateAdminContentItem} className="form-stack plan-form">
                        <input type="hidden" name="kind" value={group.kind} />
                        <input type="hidden" name="id" value={item.id} />
                        <div className="field">
                          <label>Título</label>
                          <input className="input" name="title" defaultValue={item.title} required />
                        </div>
                        <div className="field">
                          <label>{group.kind === "mission" ? "Objetivo" : group.kind === "assessment" ? "Instruções" : "Descrição"}</label>
                          <textarea className="textarea" name="description" defaultValue={description || ""} />
                        </div>
                        <button className="button button-secondary button-small" type="submit">Salvar</button>
                      </form>
                    </details>

                    <div className="plan-admin-actions">
                      {item.status !== "archived" ? (
                        <form action={setAdminContentStatus}>
                          <input type="hidden" name="kind" value={group.kind} />
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value="archived" />
                          <button className="button button-ghost button-small" type="submit">Arquivar</button>
                        </form>
                      ) : (
                        <form action={setAdminContentStatus}>
                          <input type="hidden" name="kind" value={group.kind} />
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value="draft" />
                          <button className="button button-secondary button-small" type="submit">Voltar a rascunho</button>
                        </form>
                      )}

                      <details className="plan-editor">
                        <summary className="button button-danger button-small">Excluir</summary>
                        <form action={moveAdminContentToTrash} className="form-stack compact-form">
                          <input type="hidden" name="kind" value={group.kind} />
                          <input type="hidden" name="id" value={item.id} />
                          <div className="field">
                            <label>Motivo opcional</label>
                            <input className="input" name="reason" placeholder="Ex.: conteúdo criado por engano" />
                          </div>
                          <button className="button button-danger button-small" type="submit">Enviar para a Lixeira</button>
                        </form>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title={`Nenhum item em ${group.title}`} description="Quando houver itens operacionais, eles aparecerão aqui." />
          )}
        </section>
      ))}
    </>
  );
}
