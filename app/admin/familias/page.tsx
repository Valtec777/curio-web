import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setInstitutionalAccess, updateUserProfileAdmin } from "@/app/admin/actions";
import { moveGuardianToTrash } from "./actions";

export default async function AdminFamiliesPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: rawFamilies }, { data: trashed }] = await Promise.all([
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
  ]);
  const trashedIds = new Set((trashed ?? []).map((item: any) => item.entity_id));
  const families = (rawFamilies ?? []).filter((family: any) => !trashedIds.has(family.id));

  return (
    <>
      <PageHeader eyebrow="Admin • Pessoas" title="Famílias" description="Edite dados do responsável, veja as crianças vinculadas, retire o acesso ou envie para a Lixeira sem apagar o histórico." />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
      <section className="panel">
        {families.length ? <div className="people-admin-grid">{families.map((family: any) => <article className="person-admin-card" key={family.id}>
          <div className="flex space-between gap-8 wrap"><div><h3>{family.profiles?.preferred_name || family.profiles?.full_name || "Responsável"}</h3><p>{family.profiles?.full_name}</p></div><Badge tone={family.active ? "green" : "neutral"}>{family.active ? "Acesso ativo" : "Acesso retirado"}</Badge></div>
          <p>{family.profiles?.phone_whatsapp || "Sem WhatsApp informado"}</p>
          <div className="person-links"><strong>Crianças vinculadas</strong>{family.guardian_students?.length ? family.guardian_students.map((link: any) => <span key={link.student_id}>{link.students?.preferred_name || link.students?.full_name || "Aluno"} · {link.relationship || "responsável"}</span>) : <span className="muted">Nenhuma criança vinculada</span>}</div>
          <details className="plan-editor"><summary>Editar responsável</summary><form action={updateUserProfileAdmin} className="form-stack"><input type="hidden" name="profileId" value={family.profile_id} /><input type="hidden" name="returnTo" value="/admin/familias" /><div className="field"><label>Nome completo</label><input className="input" name="fullName" defaultValue={family.profiles?.full_name || ""} required /></div><div className="field"><label>Nome preferido</label><input className="input" name="preferredName" defaultValue={family.profiles?.preferred_name || ""} /></div><div className="field"><label>WhatsApp</label><input className="input" name="phone" defaultValue={family.profiles?.phone_whatsapp || ""} /></div><button className="button button-secondary button-small" type="submit">Salvar alterações</button></form></details>
          <div className="plan-admin-actions">
            <form action={setInstitutionalAccess}><input type="hidden" name="profileId" value={family.profile_id} /><input type="hidden" name="role" value="guardian" /><input type="hidden" name="enabled" value={family.active ? "false" : "true"} /><input type="hidden" name="returnTo" value="/admin/familias" /><button className={`button button-small ${family.active ? "button-danger" : "button-primary"}`} type="submit">{family.active ? "Retirar acesso da família" : "Reativar acesso"}</button></form>
            <details className="plan-editor"><summary className="button button-danger button-small">Excluir</summary><form action={moveGuardianToTrash} className="form-stack compact-form"><input type="hidden" name="guardianId" value={family.id} /><div className="field"><label>Motivo opcional</label><input className="input" name="reason" placeholder="Ex.: cadastro duplicado" /></div><p className="muted">Os filhos, assinaturas e demais históricos serão preservados.</p><button className="button button-danger button-small" type="submit">Enviar para a Lixeira</button></form></details>
          </div>
        </article>)}</div> : <EmptyState title="Nenhuma família cadastrada" description="As famílias aparecerão aqui após a matrícula e o vínculo." />}
      </section>
    </>
  );
}
