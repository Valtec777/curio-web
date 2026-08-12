import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inviteTeacherAccess, resendAccessInvitation, setInstitutionalAccess, updateTeacherAdmin } from "@/app/admin/actions";
import { sendAdminAccessLink, updateAdminAccessContact } from "@/app/admin/access-actions";
import { moveTeacherToTrash, updateTeacherTeachingProfile } from "./actions";
import { TeacherInviteSubmitButton } from "./submit-button";

const availabilityOptions = ["Manhã", "Tarde", "Noite"];

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();

  const [
    { data: teachers },
    { data: invitations },
    { data: trashItems },
    { data: subjects },
    { data: subjectLinks },
    { data: availabilityRows },
  ] = await Promise.all([
    supabase
      .from("teachers")
      .select("id,profile_id,active,phone_whatsapp,professional_description,created_at,profiles(full_name,preferred_name,phone_whatsapp)")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("access_invitations")
      .select("id,email,full_name,preferred_name,phone_whatsapp,status,sent_at,accepted_at,last_error,auth_user_id,created_at")
      .eq("role", "teacher")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(160),
    supabase
      .from("trash_items")
      .select("entity_id")
      .eq("entity_type", "teachers")
      .is("restored_at", null),
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("teacher_subjects").select("teacher_id,subject_id"),
    supabase.from("teacher_availability").select("teacher_id,available_periods,notes"),
  ]);

  const trashedTeacherIds = new Set((trashItems ?? []).map((item: any) => item.entity_id).filter(Boolean));
  const visibleTeachers = (teachers ?? []).filter((teacher: any) => !trashedTeacherIds.has(teacher.id));
  const subjectNameById = new Map((subjects ?? []).map((subject: any) => [subject.id, subject.name]));
  const availabilityByTeacher = new Map((availabilityRows ?? []).map((item: any) => [item.teacher_id, item]));
  const latestInviteByProfile = new Map<string, any>();
  for (const invite of invitations ?? []) {
    if (invite.auth_user_id && !latestInviteByProfile.has(invite.auth_user_id)) latestInviteByProfile.set(invite.auth_user_id, invite);
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin • Pessoas"
        title="Professores"
        description="Equipe, acesso, contato, matérias e disponibilidade em uma única tela. O Admin pode corrigir o login e enviar um novo link a qualquer momento."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Novo professor</h2>
              <p>Cadastre o essencial. O professor define a própria senha pelo link recebido.</p>
            </div>
          </div>
          <form action={inviteTeacherAccess} className="form-stack">
            <div className="field"><label>Nome completo *</label><input className="input" name="fullName" required /></div>
            <div className="field"><label>Nome preferido</label><input className="input" name="preferredName" /></div>
            <div className="field"><label>E-mail *</label><input className="input" type="email" name="email" required /></div>
            <div className="field"><label>WhatsApp</label><input className="input" name="phone" /></div>
            <TeacherInviteSubmitButton />
          </form>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2>Acessos recentes</h2><p>Somente o que ainda importa acompanhar.</p></div></div>
          {invitations?.length ? (
            <div className="form-stack">
              {invitations.slice(0, 8).map((invite: any) => (
                <article className="access-invite-card" key={invite.id}>
                  <div className="flex space-between gap-8 wrap">
                    <div><strong>{invite.full_name}</strong><p>{invite.email}</p></div>
                    <Badge tone={invite.status === "accepted" ? "green" : invite.status === "error" ? "pink" : "yellow"}>{invite.status === "accepted" ? "Conta vinculada" : invite.status === "error" ? "Revisar acesso" : "Convite enviado"}</Badge>
                  </div>
                  {invite.status !== "accepted" && (
                    <form action={resendAccessInvitation}>
                      <input type="hidden" name="invitationId" value={invite.id} />
                      <input type="hidden" name="returnTo" value="/admin/professores" />
                      <button className="button button-secondary button-small" type="submit">Reenviar link</button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          ) : <p className="muted">Nenhum convite recente.</p>}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Equipe cadastrada</h2>
            <p>{visibleTeachers.length} professor(es) disponível(is) na gestão.</p>
          </div>
        </div>

        {visibleTeachers.length ? (
          <div className="people-admin-grid">
            {visibleTeachers.map((teacher: any) => {
              const invite = latestInviteByProfile.get(teacher.profile_id);
              const teacherSubjectIds = new Set((subjectLinks ?? []).filter((link: any) => link.teacher_id === teacher.id).map((link: any) => link.subject_id));
              const teacherSubjects = [...teacherSubjectIds].map((id) => subjectNameById.get(id)).filter(Boolean);
              const availability: any = availabilityByTeacher.get(teacher.id);
              const periods: string[] = availability?.available_periods || [];

              return (
                <article className="person-admin-card" key={teacher.id}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <h3>{teacher.profiles?.preferred_name || teacher.profiles?.full_name}</h3>
                      <p>{invite?.email || "E-mail vinculado ao acesso"}</p>
                    </div>
                    <div className="flex gap-8 wrap">
                      <Badge tone={teacher.active ? "green" : "neutral"}>{teacher.active ? "Ativo" : "Acesso retirado"}</Badge>
                      {invite && <Badge tone={invite.status === "accepted" ? "blue" : invite.status === "error" ? "pink" : "yellow"}>{invite.status === "accepted" ? "Conta vinculada" : invite.status === "error" ? "Acesso com erro" : "Aguardando acesso"}</Badge>}
                    </div>
                  </div>

                  <div className="teacher-summary-block">
                    <div><small>WhatsApp</small><strong>{teacher.phone_whatsapp || teacher.profiles?.phone_whatsapp || invite?.phone_whatsapp || "Não informado"}</strong></div>
                    <div><small>Matérias / especialidades</small><div className="plan-meta-chips">{teacherSubjects.length ? teacherSubjects.map((name) => <span key={String(name)}>{name}</span>) : <span>Nenhuma selecionada</span>}</div></div>
                    <div><small>Disponibilidade</small><div className="plan-meta-chips">{periods.length ? periods.map((period) => <span key={period}>{period}</span>) : <span>A confirmar</span>}</div></div>
                  </div>

                  {teacher.professional_description && <p>{teacher.professional_description}</p>}
                  {availability?.notes && <p className="muted text-small">Agenda: {availability.notes}</p>}

                  <details className="plan-editor">
                    <summary>Acesso e contato</summary>
                    <form action={updateAdminAccessContact} className="form-stack compact-form">
                      <input type="hidden" name="profileId" value={teacher.profile_id} />
                      <input type="hidden" name="returnTo" value="/admin/professores" />
                      <div className="field"><label>Nome completo</label><input className="input" name="fullName" defaultValue={teacher.profiles?.full_name || invite?.full_name || ""} required /></div>
                      <div className="field"><label>Nome preferido</label><input className="input" name="preferredName" defaultValue={teacher.profiles?.preferred_name || invite?.preferred_name || ""} /></div>
                      <div className="field"><label>E-mail de acesso</label><input className="input" type="email" name="email" defaultValue={invite?.email || ""} placeholder="email@exemplo.com" /></div>
                      <div className="field"><label>WhatsApp</label><input className="input" name="phone" defaultValue={teacher.phone_whatsapp || teacher.profiles?.phone_whatsapp || invite?.phone_whatsapp || ""} /></div>
                      <small className="muted">A alteração mantém a mesma conta, os alunos e todo o histórico.</small>
                      <button className="button button-secondary button-small" type="submit">Salvar acesso e contato</button>
                    </form>
                  </details>

                  <details className="plan-editor">
                    <summary>Matérias e disponibilidade</summary>
                    <form action={updateTeacherTeachingProfile} className="form-stack compact-form">
                      <input type="hidden" name="teacherId" value={teacher.id} />
                      <div className="field">
                        <label>Matérias / especialidades</label>
                        <div className="choice-chip-grid">
                          {(subjects ?? []).map((subject: any) => (
                            <label className="choice-chip" key={subject.id}>
                              <input type="checkbox" name="subjectIds" value={subject.id} defaultChecked={teacherSubjectIds.has(subject.id)} />
                              <span>{subject.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="field">
                        <label>Períodos disponíveis</label>
                        <div className="choice-chip-grid">
                          {availabilityOptions.map((period) => (
                            <label className="choice-chip" key={period}>
                              <input type="checkbox" name="availablePeriods" value={period} defaultChecked={periods.includes(period)} />
                              <span>{period}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="field"><label>Dias / observações de agenda</label><input className="input" name="availabilityNotes" defaultValue={availability?.notes || ""} placeholder="Ex.: segunda e quarta à tarde" /></div>
                      <button className="button button-secondary button-small" type="submit">Salvar disponibilidade</button>
                    </form>
                  </details>

                  <details className="plan-editor">
                    <summary>Dados profissionais</summary>
                    <form action={updateTeacherAdmin} className="form-stack">
                      <input type="hidden" name="teacherId" value={teacher.id} />
                      <input type="hidden" name="profileId" value={teacher.profile_id} />
                      <div className="field"><label>Nome completo</label><input className="input" name="fullName" defaultValue={teacher.profiles?.full_name || ""} required /></div>
                      <div className="field"><label>Nome preferido</label><input className="input" name="preferredName" defaultValue={teacher.profiles?.preferred_name || ""} /></div>
                      <div className="field"><label>WhatsApp</label><input className="input" name="phone" defaultValue={teacher.phone_whatsapp || teacher.profiles?.phone_whatsapp || ""} /></div>
                      <div className="field"><label>Descrição profissional</label><textarea className="textarea" name="professionalDescription" defaultValue={teacher.professional_description || ""} /></div>
                      <button className="button button-secondary button-small" type="submit">Salvar dados profissionais</button>
                    </form>
                  </details>

                  <div className="plan-admin-actions">
                    <form action={sendAdminAccessLink}>
                      <input type="hidden" name="profileId" value={teacher.profile_id} />
                      <input type="hidden" name="returnTo" value="/admin/professores" />
                      <button className="button button-primary button-small" type="submit">Enviar novo link de acesso</button>
                    </form>
                    <form action={setInstitutionalAccess}>
                      <input type="hidden" name="profileId" value={teacher.profile_id} />
                      <input type="hidden" name="role" value="teacher" />
                      <input type="hidden" name="enabled" value={teacher.active ? "false" : "true"} />
                      <input type="hidden" name="returnTo" value="/admin/professores" />
                      <button className={`button button-small ${teacher.active ? "button-ghost" : "button-primary"}`} type="submit">
                        {teacher.active ? "Desativar professor" : "Reativar professor"}
                      </button>
                    </form>

                    <details className="plan-editor">
                      <summary className="button button-danger button-small">Excluir</summary>
                      <form action={moveTeacherToTrash} className="form-stack compact-form">
                        <input type="hidden" name="teacherId" value={teacher.id} />
                        <div className="field"><label>Motivo opcional</label><input className="input" name="reason" placeholder="Ex.: cadastro duplicado" /></div>
                        <p className="muted">Alunos, turmas, missões e correções permanecem no histórico.</p>
                        <button className="button button-danger button-small" type="submit">Enviar para a Lixeira</button>
                      </form>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Nenhum professor cadastrado" description="A equipe aparecerá aqui." />
        )}
      </section>
    </>
  );
}