import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setInstitutionalAccess } from "@/app/admin/actions";
import { sendAdminAccessLink, updateAdminAccessContact } from "@/app/admin/access-actions";
import { moveGuardianToTrash } from "./actions";

export default async function AdminFamiliesPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: rawFamilies }, { data: trashed }, { data: invitations }] = await Promise.all([
    supabase
      .from("guardians")
      .select("id,profile_id,active,created_at,profiles(full_name,preferred_name,phone_whatsapp),guardian_students(student_id,relationship,students(preferred_name,full_name))")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("trash_items")
      .select("entity_id")
      .eq("entity_type", "guardians")
      .is("restored_at", null),
    supabase
      .from("access_invitations")
      .select("id,auth_user_id,email,full_name,preferred_name,phone_whatsapp,status,created_at")
      .eq("role", "guardian")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const trashedIds = new Set((trashed ?? []).map((item: any) => item.entity_id));
  const families = (rawFamilies ?? []).filter((family: any) => !trashedIds.has(family.id));
  const latestInviteByProfile = new Map<string, any>();
  for (const invite of invitations ?? []) {
    if (invite.auth_user_id && !latestInviteByProfile.has(invite.auth_user_id)) {
      latestInviteByProfile.set(invite.auth_user_id, invite);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Admin • Pessoas" title="Famílias" description="Responsáveis, dados de acesso e crianças vinculadas em uma única visão. O Admin pode corrigir contato e enviar um novo link sem depender da família solicitar externamente." />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
      <section className="panel">
        {families.length ? <div className="people-admin-grid">{families.map((family: any) => {
          const invite = latestInviteByProfile.get(family.profile_id);
          const email = invite?.email;
          const children = family.guardian_students ?? [];
          return <article className="person-admin-card" key={family.id}>
            <div className="flex space-between gap-8 wrap">
              <div>
                <h3>{family.profiles?.preferred_name || family.profiles?.full_name || "Responsável"}</h3>
                <p>{email || "E-mail de acesso não localizado no histórico de convite"}</p>
              </div>
              <Badge tone={family.active ? "green" : "neutral"}>{family.active ? "Acesso ativo" : "Acesso retirado"}</Badge>
            </div>

            <div className="teacher-summary-block">
              <div><small>Telefone / WhatsApp</small><strong>{family.profiles?.phone_whatsapp || invite?.phone_whatsapp || "Não informado"}</strong></div>
              <div><small>Crianças vinculadas</small><strong>{children.length}</strong></div>
            </div>

            <div className="person-links">
              <strong>{children.length === 1 ? "Criança vinculada" : "Crianças vinculadas"}</strong>
              {children.length ? children.map((link: any) => (
                <span key={link.student_id}>{link.students?.preferred_name || link.students?.full_name || "Aluno"} · {link.relationship || "Responsável legal"}</span>
              )) : <span className="muted">Nenhuma criança vinculada</span>}
            </div>

            <details className="plan-editor">
              <summary>Editar acesso e contato</summary>
              <form action={updateAdminAccessContact} className="form-stack">
                <input type="hidden" name="profileId" value={family.profile_id} />
                <input type="hidden" name="returnTo" value="/admin/familias" />
                <div className="field"><label>Nome completo</label><input className="input" name="fullName" defaultValue={family.profiles?.full_name || invite?.full_name || ""} required /></div>
                <div className="field"><label>Nome preferido</label><input className="input" name="preferredName" defaultValue={family.profiles?.preferred_name || invite?.preferred_name || ""} /></div>
                <div className="field"><label>E-mail de acesso</label><input className="input" type="email" name="email" defaultValue={email || ""} placeholder="email@exemplo.com" /></div>
                <div className="field"><label>WhatsApp</label><input className="input" name="phone" defaultValue={family.profiles?.phone_whatsapp || invite?.phone_whatsapp || ""} /></div>
                <small className="muted">Se o e-mail for alterado, o login é atualizado na mesma conta. Nenhum aluno ou vínculo é recriado.</small>
                <button className="button button-secondary button-small" type="submit">Salvar acesso e contato</button>
              </form>
            </details>

            <div className="plan-admin-actions">
              <form action={sendAdminAccessLink}>
                <input type="hidden" name="profileId" value={family.profile_id} />
                <input type="hidden" name="returnTo" value="/admin/familias" />
                <button className="button button-primary button-small" type="submit">Enviar novo link de acesso</button>
              </form>
              <form action={setInstitutionalAccess}>
                <input type="hidden" name="profileId" value={family.profile_id} />
                <input type="hidden" name="role" value="guardian" />
                <input type="hidden" name="enabled" value={family.active ? "false" : "true"} />
                <input type="hidden" name="returnTo" value="/admin/familias" />
                <button className={`button button-small ${family.active ? "button-danger" : "button-primary"}`} type="submit">{family.active ? "Retirar acesso da família" : "Reativar acesso"}</button>
              </form>
              <details className="plan-editor">
                <summary className="button button-danger button-small">Excluir</summary>
                <form action={moveGuardianToTrash} className="form-stack compact-form">
                  <input type="hidden" name="guardianId" value={family.id} />
                  <div className="field"><label>Motivo opcional</label><input className="input" name="reason" placeholder="Ex.: cadastro duplicado" /></div>
                  <p className="muted">As crianças, assinaturas e demais históricos serão preservados.</p>
                  <button className="button button-danger button-small" type="submit">Enviar para a Lixeira</button>
                </form>
              </details>
            </div>
          </article>;
        })}</div> : <EmptyState title="Nenhuma família cadastrada" description="As famílias aparecerão aqui após a matrícula e o vínculo." />}
      </section>
    </>
  );
}