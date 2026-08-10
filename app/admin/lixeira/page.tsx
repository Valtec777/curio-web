import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { permanentlyDeleteTrashItem, restoreTrashItem } from "./actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function typeLabel(entityType: string) {
  const labels: Record<string, string> = {
    plans: "Plano",
    access_invitations: "Convite / matrícula",
    enrollment_requests: "Solicitação de matrícula",
    students: "Aluno",
    teachers: "Professor",
    guardians: "Família / responsável",
    messages: "Mensagem",
    missions: "Missão Cuca",
    materials: "Material",
    notebook_activities: "Caderno Curió",
    assessments: "Avaliação",
    documents: "Documento operacional",
  };
  return labels[entityType] || entityType;
}

function canRestore(entityType: string) {
  return [
    "plans",
    "access_invitations",
    "enrollment_requests",
    "students",
    "teachers",
    "guardians",
    "messages",
    "missions",
    "materials",
    "notebook_activities",
    "assessments",
    "documents",
  ].includes(entityType);
}

function canPermanentlyDelete(item: any) {
  if (item.entity_type === "enrollment_requests") return true;
  if (item.entity_type !== "access_invitations") return false;
  const snapshot = item.entity_snapshot || {};
  return !snapshot.auth_user_id && ["error", "cancelled"].includes(String(snapshot.previous_status || ""));
}

export default async function AdminTrashPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("trash_items")
    .select("id,entity_type,entity_id,entity_snapshot,deleted_by_user_id,deleted_at,restore_until,restored_at")
    .is("restored_at", null)
    .order("deleted_at", { ascending: false })
    .limit(120);

  const actorIds = [...new Set((items ?? []).map((item: any) => item.deleted_by_user_id).filter(Boolean))];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id,full_name,preferred_name").in("id", actorIds) : { data: [] as any[] };
  const actorName = new Map((actors ?? []).map((profile: any) => [profile.id, profile.preferred_name || profile.full_name]));

  return (
    <>
      <PageHeader eyebrow="Operação CURIÓ" title="Lixeira" description="Registros excluídos saem da operação normal sem apagar automaticamente o histórico importante." />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
      <div className="notice">Arquivar, cancelar e excluir são ações diferentes. A Lixeira usa exclusão lógica e mantém o mesmo ID para restauração quando o tipo de registro permite.</div>

      <section className="panel">
        <div className="panel-head"><div><h2>Itens removidos</h2><p>{items?.length ?? 0} registro(s) aguardando restauração ou decisão administrativa.</p></div></div>
        {items?.length ? (
          <div className="form-stack">
            {items.map((item: any) => {
              const snapshot = item.entity_snapshot || {};
              const expired = Boolean(item.restore_until && new Date(item.restore_until).getTime() < Date.now());
              return (
                <article className="mission-card" key={item.id}>
                  <div className="flex space-between gap-8 wrap"><div><strong>{snapshot.label || typeLabel(item.entity_type)}</strong><p>{typeLabel(item.entity_type)}</p></div><Badge tone={expired ? "pink" : "neutral"}>{expired ? "Prazo encerrado" : "Na Lixeira"}</Badge></div>
                  <div className="form-stack compact-form">
                    {snapshot.email && <small className="muted">{snapshot.email}</small>}
                    {snapshot.body_preview && <p className="muted">“{snapshot.body_preview}”</p>}
                    {snapshot.file_path && <div className="asset-path">{snapshot.file_path}</div>}
                    <small className="muted">Removido em {dt(item.deleted_at)} por {actorName.get(item.deleted_by_user_id) || "Sistema / Admin"}</small>
                    <small className="muted">Restaurável até {dt(item.restore_until)}</small>
                    {snapshot.reason && <p><strong>Motivo:</strong> {snapshot.reason}</p>}
                    {snapshot.dependencies && <small className="muted">Dependências preservadas no histórico.</small>}
                    {typeof snapshot.dependency_count === "number" && <small className="muted">Vínculos preservados: {snapshot.dependency_count}</small>}
                    {snapshot.previous_status && <small className="muted">Status anterior: {snapshot.previous_status}</small>}
                    {item.entity_id && <small className="muted">ID preservado: {item.entity_id}</small>}
                  </div>
                  <div className="plan-admin-actions mt-12">
                    {canRestore(item.entity_type) && !expired && <form action={restoreTrashItem}><input type="hidden" name="trashId" value={item.id} /><button className="button button-secondary button-small" type="submit">Restaurar</button></form>}
                    {canPermanentlyDelete(item) && <details className="plan-editor"><summary className="button button-danger button-small">Excluir permanentemente</summary><form action={permanentlyDeleteTrashItem} className="form-stack compact-form"><input type="hidden" name="trashId" value={item.id} /><p className="muted">Esta ação não poderá ser desfeita.</p><button className="button button-danger button-small" type="submit">Confirmar exclusão permanente</button></form></details>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Lixeira vazia" description="Itens excluídos de áreas compatíveis aparecerão aqui durante a janela de restauração." />}
      </section>
    </>
  );
}
