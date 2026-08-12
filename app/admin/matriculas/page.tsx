import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  cancelGuardianInvitation,
  createGuardianEnrollment,
  moveEnrollmentRequestToTrash,
  moveGuardianInvitationToTrash,
  resendGuardianInvitation,
} from "./actions";
import { updateEnrollmentAssignments, updateEnrollmentDetails } from "./edit-actions";
import { EnrollmentSubmitButton } from "./submit-button";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function statusLabel(status?: string | null) {
  if (status === "accepted") return "Acesso ativo";
  if (status === "sent") return "Convite enviado";
  if (status === "pending") return "Processando";
  if (status === "cancelled") return "Cancelado";
  if (status === "error") return "Precisa de atenção";
  return status || "—";
}

function statusTone(status?: string | null): "green" | "yellow" | "pink" | "blue" | "neutral" {
  if (status === "accepted") return "green";
  if (status === "error") return "pink";
  if (status === "cancelled") return "neutral";
  return "yellow";
}

const relationshipOptions = ["Mãe", "Pai", "Avó", "Avô", "Tia", "Tio", "Responsável legal", "Outro"];

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; op?: string; lead?: string }>;
}) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const operationFromRetry = String(query.op || "").trim();
  const idempotencyKey = operationFromRetry.length >= 8 && operationFromRetry.length <= 160 ? operationFromRetry : randomUUID();
  const requestedLeadId = /^[0-9a-f-]{36}$/i.test(String(query.lead || "")) ? String(query.lead) : "";

  const [
    { data: requests },
    { data: grades },
    { data: invitations },
    { data: teachers },
    { data: plans },
    { data: subjects },
  ] = await Promise.all([
    supabase
      .from("enrollment_requests")
      .select("id,guardian_name,email,phone_whatsapp,child_name,child_age,grade_id,subjects,main_difficulties,message,status,created_at,grades(name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase.from("grades").select("id,name,sort_order,active").eq("active", true).order("sort_order"),
    supabase
      .from("access_invitations")
      .select("id,email,full_name,preferred_name,phone_whatsapp,relationship,status,sent_at,accepted_at,last_error,student_id,auth_user_id,teacher_id,plan_id,enrollment_finalized_at,created_at,teachers(profiles(full_name,preferred_name)),plans(name)")
      .eq("role", "guardian")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("teachers")
      .select("id,profile_id,profiles(full_name,preferred_name)")
      .eq("active", true)
      .order("created_at"),
    supabase
      .from("plans")
      .select("id,name,monthly_price,meetings_per_month")
      .eq("active", true)
      .eq("available_for_enrollment", true)
      .is("archived_at", null)
      .is("deleted_at", null)
      .order("sort_order"),
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
  ]);

  const selectedLead: any = requestedLeadId ? (requests ?? []).find((item: any) => item.id === requestedLeadId) : null;
  const selectedLeadSubjects = new Set<string>(selectedLead?.subjects || []);
  const studentIds = [...new Set((invitations ?? []).map((item: any) => item.student_id).filter(Boolean))];
  const profileIds = [...new Set((invitations ?? []).map((item: any) => item.auth_user_id).filter(Boolean))];

  const [{ data: enrollmentStudents }, { data: enrollmentProfiles }, { data: enrollmentGuardians }] = await Promise.all([
    studentIds.length
      ? supabase.from("students").select("id,full_name,preferred_name,grade_id,school_name,deleted_at").in("id", studentIds).is("deleted_at", null)
      : Promise.resolve({ data: [] as any[] }),
    profileIds.length
      ? supabase.from("profiles").select("id,full_name,preferred_name,phone_whatsapp").in("id", profileIds)
      : Promise.resolve({ data: [] as any[] }),
    profileIds.length
      ? supabase.from("guardians").select("id,profile_id,active").in("profile_id", profileIds).eq("active", true)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const guardianIds = (enrollmentGuardians ?? []).map((item: any) => item.id);
  const [{ data: studentPrivateRows }, { data: learningProfileRows }, { data: guardianPrivateRows }] = await Promise.all([
    studentIds.length
      ? supabase.from("student_private_details").select("student_id,birth_date,cpf").in("student_id", studentIds)
      : Promise.resolve({ data: [] as any[] }),
    studentIds.length
      ? supabase.from("student_learning_profiles").select("student_id,tracked_subjects,pedagogical_notes").in("student_id", studentIds)
      : Promise.resolve({ data: [] as any[] }),
    guardianIds.length
      ? supabase.from("guardian_private_details").select("guardian_id,cpf,address").in("guardian_id", guardianIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const studentById = new Map((enrollmentStudents ?? []).map((item: any) => [item.id, item]));
  const profileById = new Map((enrollmentProfiles ?? []).map((item: any) => [item.id, item]));
  const guardianByProfileId = new Map((enrollmentGuardians ?? []).map((item: any) => [item.profile_id, item]));
  const studentPrivateById = new Map((studentPrivateRows ?? []).map((item: any) => [item.student_id, item]));
  const learningProfileById = new Map((learningProfileRows ?? []).map((item: any) => [item.student_id, item]));
  const guardianPrivateById = new Map((guardianPrivateRows ?? []).map((item: any) => [item.guardian_id, item]));
  const openLeads = (requests ?? []).filter((item: any) => ["new", "contacted", "qualified"].includes(item.status));

  return (
    <>
      <PageHeader
        eyebrow="Admin • Pessoas"
        title="Matrículas"
        description="Uma sequência única para cadastrar a criança, liberar a família, escolher professor e plano e concluir todos os vínculos sem duplicar registros."
        action={<Link className="button button-secondary" href="#novos-interesses">Ver novos interesses</Link>}
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      {selectedLead && (
        <div className="enrollment-lead-banner">
          <div>
            <Badge tone="yellow">Interesse selecionado</Badge>
            <strong>{selectedLead.guardian_name}</strong>
            <span>{selectedLead.child_name || "Criança ainda não informada"}</span>
          </div>
          <Link className="button button-ghost button-small" href="/admin/matriculas#nova-matricula">Limpar preenchimento</Link>
        </div>
      )}

      <section className="enrollment-flow" id="nova-matricula">
        <div className="enrollment-flow-head">
          <div>
            <span className="eyebrow">Nova matrícula</span>
            <h2>Da criança ao acesso, em uma única escadinha</h2>
            <p>Os dados sensíveis ficam restritos ao Admin. Não há mais tipo “teste” ou “demonstração” nesta etapa.</p>
          </div>
          <div className="enrollment-progress" aria-label="Etapas da matrícula">
            <span><b>1</b>Criança</span>
            <span><b>2</b>Família</span>
            <span><b>3</b>Professor</span>
            <span><b>4</b>Plano</span>
            <span><b>5</b>Revisão</span>
          </div>
        </div>

        <form action={createGuardianEnrollment} className="enrollment-form">
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <input type="hidden" name="leadId" value={selectedLead?.id || ""} />

          <section className="enrollment-step enrollment-step-lime">
            <div className="enrollment-step-title"><span>1</span><div><h3>Dados da criança</h3><p>O que precisamos para começar o acompanhamento.</p></div></div>
            <div className="form-row">
              <div className="field"><label>Nome completo *</label><input className="input" name="childName" defaultValue={selectedLead?.child_name || ""} required /></div>
              <div className="field"><label>Nome preferido</label><input className="input" name="childPreferredName" /></div>
            </div>
            <div className="form-row">
              <div className="field"><label>Data de nascimento</label><input className="input" type="date" name="birthDate" /></div>
              <div className="field">
                <label>Ano escolar</label>
                <select className="select" name="gradeId" defaultValue={selectedLead?.grade_id || ""}>
                  <option value="">Selecionar</option>
                  {(grades ?? []).map((grade: any) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field"><label>Escola</label><input className="input" name="schoolName" /></div>
              <div className="field"><label>CPF da criança <span className="field-optional">opcional</span></label><input className="input" name="childCpf" inputMode="numeric" autoComplete="off" /></div>
            </div>
            <div className="field">
              <label>Matérias acompanhadas</label>
              <div className="choice-chip-grid">
                {(subjects ?? []).map((subject: any) => (
                  <label className="choice-chip" key={subject.id}>
                    <input type="checkbox" name="subjects" value={subject.name} defaultChecked={selectedLeadSubjects.has(subject.name)} />
                    <span>{subject.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field"><label>Observações pedagógicas necessárias</label><textarea className="textarea" name="pedagogicalNotes" defaultValue={selectedLead?.main_difficulties || selectedLead?.message || ""} placeholder="Somente o que realmente ajuda no acompanhamento." /></div>
          </section>

          <section className="enrollment-step enrollment-step-purple">
            <div className="enrollment-step-title"><span>2</span><div><h3>Responsável principal</h3><p>Este responsável recebe o primeiro acesso da família.</p></div></div>
            <div className="form-row">
              <div className="field"><label>Nome completo *</label><input className="input" name="fullName" defaultValue={selectedLead?.guardian_name || ""} required /></div>
              <div className="field"><label>Nome preferido</label><input className="input" name="preferredName" /></div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Parentesco / vínculo *</label>
                <select className="select" name="relationship" defaultValue="Responsável legal" required>
                  {relationshipOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="field"><label>E-mail *</label><input className="input" type="email" name="email" defaultValue={selectedLead?.email || ""} required /></div>
            </div>
            <div className="form-row">
              <div className="field"><label>Telefone / WhatsApp</label><input className="input" name="phone" defaultValue={selectedLead?.phone_whatsapp || ""} /></div>
              <div className="field"><label>CPF <span className="field-optional">opcional</span></label><input className="input" name="guardianCpf" inputMode="numeric" autoComplete="off" /></div>
            </div>
            <div className="field"><label>Endereço <span className="field-optional">quando necessário</span></label><textarea className="textarea textarea-compact" name="guardianAddress" /></div>

            <details className="second-guardian">
              <summary>+ Adicionar segundo responsável</summary>
              <div className="second-guardian-body">
                <div className="form-row">
                  <div className="field"><label>Nome completo</label><input className="input" name="secondGuardianName" /></div>
                  <div className="field">
                    <label>Parentesco / vínculo</label>
                    <select className="select" name="secondGuardianRelationship" defaultValue="Responsável legal">
                      {relationshipOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="field"><label>E-mail</label><input className="input" type="email" name="secondGuardianEmail" /></div>
                  <div className="field"><label>Telefone / WhatsApp</label><input className="input" name="secondGuardianPhone" /></div>
                </div>
                <div className="form-row">
                  <div className="field"><label>CPF <span className="field-optional">opcional</span></label><input className="input" name="secondGuardianCpf" inputMode="numeric" autoComplete="off" /></div>
                  <div className="field"><label>Endereço</label><input className="input" name="secondGuardianAddress" /></div>
                </div>
                <small className="muted">Se nome e e-mail forem preenchidos, essa pessoa também receberá acesso e ficará vinculada à mesma criança.</small>
              </div>
            </details>
          </section>

          <div className="enrollment-two-steps">
            <section className="enrollment-step enrollment-step-blue">
              <div className="enrollment-step-title"><span>3</span><div><h3>Professor</h3><p>Escolha quem acompanhará a criança.</p></div></div>
              <div className="field">
                <label>Professor disponível *</label>
                <select className="select" name="teacherId" required defaultValue="">
                  <option value="" disabled>Selecionar professor</option>
                  {(teachers ?? []).map((teacher: any) => <option key={teacher.id} value={teacher.id}>{teacher.profiles?.preferred_name || teacher.profiles?.full_name || "Professor"}</option>)}
                </select>
              </div>
              {!teachers?.length && <p className="form-message form-error">Cadastre ao menos um professor ativo antes de concluir uma matrícula.</p>}
            </section>

            <section className="enrollment-step enrollment-step-pink">
              <div className="enrollment-step-title"><span>4</span><div><h3>Plano</h3><p>Escolha o plano comercial desta matrícula.</p></div></div>
              <div className="field">
                <label>Plano *</label>
                <select className="select" name="planId" required defaultValue="">
                  <option value="" disabled>Selecionar plano</option>
                  {(plans ?? []).map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name} • {money(plan.monthly_price)}{plan.meetings_per_month ? ` • ${plan.meetings_per_month} encontros/mês` : ""}</option>)}
                </select>
              </div>
              {!plans?.length && <p className="form-message form-error">Não há plano ativo disponível para matrícula.</p>}
            </section>
          </div>

          <section className="enrollment-review-card">
            <div className="enrollment-step-title"><span>5</span><div><h3>Revisão antes de concluir</h3><p>Confira os blocos acima. O botão final conecta tudo de uma vez.</p></div></div>
            <div className="review-checks">
              <span>✓ Criança e ano escolar</span>
              <span>✓ Responsável e acesso</span>
              <span>✓ Professor vinculado</span>
              <span>✓ Plano vinculado</span>
              <span>✓ Sem cadastro duplicado</span>
            </div>
            <EnrollmentSubmitButton />
          </section>
        </form>
      </section>

      <section className="panel enrollment-history-panel">
        <div className="panel-head">
          <div><h2>Matrículas recentes</h2><p>Acompanhe acesso, vínculos e edições sem recriar a criança.</p></div>
        </div>
        {invitations?.length ? (
          <div className="enrollment-card-list">
            {invitations.map((invite: any) => {
              const student: any = invite.student_id ? studentById.get(invite.student_id) : null;
              const guardianProfile: any = invite.auth_user_id ? profileById.get(invite.auth_user_id) : null;
              const guardian: any = invite.auth_user_id ? guardianByProfileId.get(invite.auth_user_id) : null;
              const studentPrivate: any = invite.student_id ? studentPrivateById.get(invite.student_id) : null;
              const learningProfile: any = invite.student_id ? learningProfileById.get(invite.student_id) : null;
              const guardianPrivate: any = guardian?.id ? guardianPrivateById.get(guardian.id) : null;
              const trackedSubjects = new Set<string>(learningProfile?.tracked_subjects || []);
              return (
                <article className="enrollment-record-card" key={invite.id}>
                  <div className="enrollment-record-main">
                    <div>
                      <span className="record-kicker">{student?.preferred_name || student?.full_name || "Matrícula em andamento"}</span>
                      <h3>{invite.full_name}</h3>
                      <p>{invite.email} {invite.phone_whatsapp ? `• ${invite.phone_whatsapp}` : ""}</p>
                    </div>
                    <div className="flex gap-8 wrap">
                      <Badge tone={statusTone(invite.status)}>{statusLabel(invite.status)}</Badge>
                      <Badge tone={invite.enrollment_finalized_at ? "green" : "yellow"}>{invite.enrollment_finalized_at ? "Matrícula concluída" : "Concluir vínculos"}</Badge>
                    </div>
                  </div>
                  <div className="record-meta-grid">
                    <span><small>Professor</small><strong>{invite.teachers?.profiles?.preferred_name || invite.teachers?.profiles?.full_name || "Pendente"}</strong></span>
                    <span><small>Plano</small><strong>{invite.plans?.name || "Pendente"}</strong></span>
                    <span><small>Escola</small><strong>{student?.school_name || "Não informada"}</strong></span>
                    <span><small>Atualização</small><strong>{dt(invite.accepted_at || invite.sent_at || invite.created_at)}</strong></span>
                  </div>
                  {invite.last_error && <p className="form-message form-error">{invite.last_error}</p>}
                  <div className="plan-admin-actions">
                    {invite.student_id && invite.auth_user_id && student && (
                      <details className="record-editor">
                        <summary>Editar dados</summary>
                        <form action={updateEnrollmentDetails} className="form-stack compact-form">
                          <input type="hidden" name="invitationId" value={invite.id} />
                          <div className="form-row">
                            <div className="field"><label>Nome da criança</label><input className="input" name="studentFullName" defaultValue={student.full_name || ""} required /></div>
                            <div className="field"><label>Nome preferido</label><input className="input" name="studentPreferredName" defaultValue={student.preferred_name || ""} /></div>
                          </div>
                          <div className="form-row">
                            <div className="field"><label>Data de nascimento</label><input className="input" type="date" name="birthDate" defaultValue={studentPrivate?.birth_date || ""} /></div>
                            <div className="field"><label>Ano escolar</label><select className="select" name="gradeId" defaultValue={student.grade_id || ""}><option value="">Não informado</option>{(grades ?? []).map((grade: any) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
                          </div>
                          <div className="form-row">
                            <div className="field"><label>Escola</label><input className="input" name="schoolName" defaultValue={student.school_name || ""} /></div>
                            <div className="field"><label>CPF da criança <span className="field-optional">opcional</span></label><input className="input" name="childCpf" inputMode="numeric" autoComplete="off" defaultValue={studentPrivate?.cpf || ""} /></div>
                          </div>
                          <div className="field">
                            <label>Matérias acompanhadas</label>
                            <div className="choice-chip-grid">
                              {(subjects ?? []).map((subject: any) => <label className="choice-chip" key={`${invite.id}-${subject.id}`}><input type="checkbox" name="subjects" value={subject.name} defaultChecked={trackedSubjects.has(subject.name)} /><span>{subject.name}</span></label>)}
                            </div>
                          </div>
                          <div className="field"><label>Observações pedagógicas necessárias</label><textarea className="textarea textarea-compact" name="pedagogicalNotes" defaultValue={learningProfile?.pedagogical_notes || ""} /></div>
                          <div className="form-row">
                            <div className="field"><label>Responsável</label><input className="input" name="guardianFullName" defaultValue={guardianProfile?.full_name || invite.full_name || ""} required /></div>
                            <div className="field"><label>Nome preferido</label><input className="input" name="guardianPreferredName" defaultValue={guardianProfile?.preferred_name || invite.preferred_name || ""} /></div>
                          </div>
                          <div className="form-row">
                            <div className="field"><label>E-mail de acesso</label><input className="input" type="email" name="email" defaultValue={invite.email || ""} required /></div>
                            <div className="field"><label>WhatsApp</label><input className="input" name="phone" defaultValue={guardianProfile?.phone_whatsapp || invite.phone_whatsapp || ""} /></div>
                          </div>
                          <div className="form-row">
                            <div className="field"><label>CPF do responsável <span className="field-optional">opcional</span></label><input className="input" name="guardianCpf" inputMode="numeric" autoComplete="off" defaultValue={guardianPrivate?.cpf || ""} /></div>
                            <div className="field"><label>Vínculo</label><input className="input" name="relationship" defaultValue={invite.relationship || "Responsável legal"} required /></div>
                          </div>
                          <div className="field"><label>Endereço do responsável <span className="field-optional">quando necessário</span></label><textarea className="textarea textarea-compact" name="guardianAddress" defaultValue={guardianPrivate?.address || ""} /></div>
                          <small className="muted">Alterar o e-mail atualiza também o login do responsável; não cria outra conta.</small>
                          <button className="button button-secondary button-small" type="submit">Salvar mantendo os mesmos registros</button>
                        </form>
                      </details>
                    )}
                    {invite.student_id && (
                      <details className="record-editor">
                        <summary>Professor / plano</summary>
                        <form action={updateEnrollmentAssignments} className="form-stack compact-form">
                          <input type="hidden" name="invitationId" value={invite.id} />
                          <div className="field"><label>Professor</label><select className="select" name="teacherId" defaultValue={invite.teacher_id || ""} required><option value="" disabled>Selecionar</option>{(teachers ?? []).map((teacher: any) => <option key={teacher.id} value={teacher.id}>{teacher.profiles?.preferred_name || teacher.profiles?.full_name || "Professor"}</option>)}</select></div>
                          <div className="field"><label>Plano</label><select className="select" name="planId" defaultValue={invite.plan_id || ""} required><option value="" disabled>Selecionar</option>{(plans ?? []).map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name} • {money(plan.monthly_price)}</option>)}</select></div>
                          <button className="button button-secondary button-small" type="submit">Salvar professor e plano</button>
                        </form>
                      </details>
                    )}
                    {!['accepted', 'cancelled'].includes(invite.status) && <form action={resendGuardianInvitation}><input type="hidden" name="invitationId" value={invite.id} /><button className="button button-secondary button-small" type="submit">Reenviar acesso</button></form>}
                    {!['accepted', 'cancelled'].includes(invite.status) && <form action={cancelGuardianInvitation}><input type="hidden" name="invitationId" value={invite.id} /><button className="button button-ghost button-small" type="submit">Cancelar convite</button></form>}
                    <details className="record-editor record-editor-danger"><summary>Excluir</summary><form action={moveGuardianInvitationToTrash} className="form-stack compact-form"><input type="hidden" name="invitationId" value={invite.id} /><div className="field"><label>Motivo opcional</label><input className="input" name="reason" placeholder="Ex.: cadastro duplicado" /></div><button className="button button-danger button-small" type="submit">Enviar para a Lixeira</button></form></details>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Nenhuma matrícula ainda" description="A primeira matrícula concluída aparecerá aqui." />}
      </section>

      <section className="panel" id="novos-interesses">
        <div className="panel-head">
          <div><h2>Novos interesses</h2><p>{openLeads.length} contato(s) aguardando acompanhamento comercial.</p></div>
        </div>
        {requests?.length ? (
          <div className="lead-card-grid">
            {requests.map((item: any) => (
              <article className={`lead-card ${item.status === "new" ? "lead-card-new" : ""}`} key={item.id}>
                <div className="flex space-between gap-8 wrap"><Badge tone={item.status === "new" ? "yellow" : item.status === "enrolled" ? "green" : "blue"}>{item.status === "new" ? "Novo interesse" : item.status === "enrolled" ? "Matriculado" : "Em acompanhamento"}</Badge><small>{dt(item.created_at)}</small></div>
                <h3>{item.guardian_name}</h3>
                <p>{item.child_name || "Criança não informada"} • {item.grades?.name || "Ano não informado"}</p>
                <small className="muted">{item.email} • {item.phone_whatsapp}</small>
                <div className="plan-admin-actions">
                  {item.status !== "enrolled" && <Link className="button button-primary button-small" href={`/admin/matriculas?lead=${item.id}#nova-matricula`}>Usar na nova matrícula</Link>}
                  <details className="record-editor record-editor-danger"><summary>Excluir</summary><form action={moveEnrollmentRequestToTrash} className="form-stack compact-form"><input type="hidden" name="requestId" value={item.id} /><div className="field"><label>Motivo opcional</label><input className="input" name="reason" /></div><button className="button button-danger button-small" type="submit">Enviar para a Lixeira</button></form></details>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Nenhum novo interesse" description="Quando alguém enviar o formulário do site, o contato aparecerá aqui." />}
      </section>
    </>
  );
}
