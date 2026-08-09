import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inviteAdminAccess, resendAccessInvitation, setInstitutionalAccess, updateUserProfileAdmin } from "@/app/admin/actions";

const roleNames: Record<string, string> = { admin: "Admin", teacher: "Professor", guardian: "Família", student: "Aluno" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const viewer = await requireRole("admin");
  const supabase = await createClient();
  const [{ data: profiles }, { data: roles }, { data: invitations }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,preferred_name,phone_whatsapp,created_at").order("created_at", { ascending: false }).limit(160),
    supabase.from("user_roles").select("user_id,role"),
    supabase.from("access_invitations").select("id,email,role,full_name,status,sent_at,accepted_at,last_error").order("created_at", { ascending: false }).limit(100),
  ]);
  const rolesByUser = new Map<string, string[]>();
  for (const row of roles ?? []) rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) || []), row.role]);

  return (
    <>
      <PageHeader eyebrow="Admin • Pessoas" title="Usuários e acessos" description="Edite perfis e conceda ou retire papéis. Retirar um papel bloqueia aquele ambiente sem apagar o histórico." />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
      <div className="grid-2">
        <section className="panel"><div className="panel-head"><div><h2>Convidar administrador</h2></div></div><form action={inviteAdminAccess} className="form-stack"><div className="field"><label>Nome completo *</label><input className="input" name="fullName" required /></div><div className="field"><label>Nome preferido</label><input className="input" name="preferredName" /></div><div className="field"><label>E-mail *</label><input className="input" type="email" name="email" required /></div><div className="field"><label>WhatsApp</label><input className="input" name="phone" /></div><button className="button button-primary" type="submit">Enviar acesso de Admin</button></form></section>
        <section className="panel"><div className="notice">Proteção: seu próprio papel de Admin não pode ser removido por este botão e o sistema não permite ficar sem nenhum administrador.</div><h3>Convites recentes</h3>{invitations?.length ? <div className="form-stack">{invitations.slice(0, 8).map((invite: any) => <article className="access-invite-card" key={invite.id}><div className="flex space-between gap-8 wrap"><div><strong>{invite.full_name}</strong><p>{invite.email}</p></div><Badge tone={invite.status === "accepted" ? "green" : "yellow"}>{roleNames[invite.role] || invite.role} · {invite.status}</Badge></div>{invite.status !== "accepted" && <form action={resendAccessInvitation}><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="returnTo" value="/admin/usuarios" /><button className="button button-secondary button-small" type="submit">Reenviar</button></form>}</article>)}</div> : <p className="muted">Nenhum convite.</p>}</section>
      </div>
      <section className="panel"><div className="panel-head"><div><h2>Perfis existentes</h2><p>Um usuário pode acumular mais de um papel.</p></div></div>{profiles?.length ? <div className="people-admin-grid">{profiles.map((profile: any) => {
        const userRoles = rolesByUser.get(profile.id) || [];
        return <article className="person-admin-card" key={profile.id}><div><div className="flex gap-8 wrap">{userRoles.map((role) => <Badge key={role} tone={role === "admin" ? "pink" : role === "teacher" ? "blue" : role === "guardian" ? "green" : "yellow"}>{roleNames[role] || role}</Badge>)}</div><h3>{profile.preferred_name || profile.full_name}</h3><p>{profile.full_name}</p><small className="muted">{profile.phone_whatsapp || "Sem telefone"}{profile.id === viewer.user.id ? " · você" : ""}</small></div><details className="plan-editor"><summary>Editar perfil</summary><form action={updateUserProfileAdmin} className="form-stack"><input type="hidden" name="profileId" value={profile.id} /><input type="hidden" name="returnTo" value="/admin/usuarios" /><div className="field"><label>Nome completo</label><input className="input" name="fullName" defaultValue={profile.full_name} required /></div><div className="field"><label>Nome preferido</label><input className="input" name="preferredName" defaultValue={profile.preferred_name || ""} /></div><div className="field"><label>WhatsApp</label><input className="input" name="phone" defaultValue={profile.phone_whatsapp || ""} /></div><button className="button button-secondary button-small" type="submit">Salvar</button></form></details><div className="role-control-grid">{(["admin", "teacher", "guardian"] as const).map((role) => { const active = userRoles.includes(role); return <form action={setInstitutionalAccess} key={role}><input type="hidden" name="profileId" value={profile.id} /><input type="hidden" name="role" value={role} /><input type="hidden" name="enabled" value={active ? "false" : "true"} /><input type="hidden" name="returnTo" value="/admin/usuarios" /><button className={`button button-small ${active ? "button-danger" : "button-ghost"}`} type="submit">{active ? `Remover ${roleNames[role]}` : `Conceder ${roleNames[role]}`}</button></form>; })}</div></article>;
      })}</div> : <EmptyState title="Nenhum perfil" description="Os perfis autenticados aparecerão aqui." />}</section>
    </>
  );
}
