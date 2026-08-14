import { EmptyState, PageHeader } from "@/components/ui";
import { updateFamilyProfile } from "@/app/familia/actions";
import { getFamilyPortal } from "@/lib/family";
import { FamilyAvatarForm } from "./avatar-form";

export default async function FamilyProfilePage({ searchParams }: { searchParams: Promise<{ aluno?: string; erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { viewer, selectedChild, supabase } = await getFamilyPortal(query.aluno || null);
  const { data: profile } = await supabase.from("profiles").select("full_name,preferred_name,phone_whatsapp,avatar_path").eq("id", viewer.user.id).maybeSingle();
  if (!profile) return <EmptyState title="Perfil de responsável não encontrado" description="A administração precisa concluir seu cadastro." />;

  let avatarUrl = "";
  if (profile.avatar_path) {
    const { data } = await supabase.storage.from("profile-avatars").createSignedUrl(profile.avatar_path, 60 * 20);
    avatarUrl = data?.signedUrl || "";
  }
  const initials = String(profile.preferred_name || profile.full_name || "F").slice(0, 1).toUpperCase();

  return (
    <>
      <PageHeader eyebrow="Ninho da Família" title="Meu perfil" description="Atualize seus dados de contato e sua foto de responsável." />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="panel">
        <div className="teacher-profile-hero">
          <div className="family-profile-photo">{avatarUrl ? <img src={avatarUrl} alt="Foto do responsável" /> : <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", fontSize: 34, fontWeight: 900 }}>{initials}</span>}</div>
          <div>
            <h2 className="mt-0">{profile.preferred_name || profile.full_name}</h2>
            <p className="muted">Membro da Família{selectedChild ? ` · acompanhando ${selectedChild.student_name}` : ""}</p>
            <FamilyAvatarForm studentId={selectedChild?.student_id || null} />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Dados do responsável</h2><p>Se alguma informação mudar, você pode atualizar por aqui.</p></div></div>
        <form action={updateFamilyProfile} className="form-stack">
          <input type="hidden" name="studentId" value={selectedChild?.student_id || ""} />
          <div className="form-row">
            <div className="field"><label>Nome completo *</label><input className="input" name="fullName" defaultValue={profile.full_name || ""} required /></div>
            <div className="field"><label>Como prefere ser chamado(a)</label><input className="input" name="preferredName" defaultValue={profile.preferred_name || ""} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>E-mail</label><input className="input" value={viewer.user.email || ""} readOnly /></div>
            <div className="field"><label>Telefone / WhatsApp</label><input className="input" name="phone" defaultValue={profile.phone_whatsapp || ""} /></div>
          </div>
          <button className="button button-primary" type="submit">Salvar perfil</button>
        </form>
      </section>
    </>
  );
}
