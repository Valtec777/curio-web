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
import { updateEnrollmentAssignments } from "./edit-actions";
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
  if (status === "error") return "Erro";
  return status || "—";
}

function statusTone(status?: string | null): "green" | "yellow" | "pink" | "blue" | "neutral" {
  if (status === "accepted") return "green";
  if (status === "error") return "pink";
  if (status === "cancelled") return "neutral";
  return "yellow";
}

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; op?: string }>;
}) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const operationFromRetry = String(query.op || "").trim();
  const idempotencyKey = operationFromRetry.length >= 8 && operationFromRetry.length <= 160 ? operationFromRetry : randomUUID();

  const [
    { data: requests },
    { data: grades },
    { data: invitations },
    { data: teachers },
    { data: plans },
  ] = await Promise.all([
    supabase
      .from("enrollment_requests")
      .select("id,guardian_name,email,phone_whatsapp,child_name,child_age,subjects,status,created_at,grades(name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("grades")
      .select("id,name,sort_order,active")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("access_invitations")
      .select("id,email,full_name,status,sent_at,accepted_at,last_error,student_id,teacher_id,plan_id,enrollment_finalized_at,created_at,teachers(profiles(full_name,preferred_name)),plans(name)")
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
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Operação CURIÓ"
        title="Matrículas"
        description="Conclua aluno, família, professor, plano e acesso no mesmo fluxo, sem recriar registros quando houver erro."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="notice">
        Proteção contra duplicidade ativa: o botão é bloqueado durante o envio, o backend reserva a operação antes de criar o aluno e uma tentativa após erro reutiliza a mesma chave de matrícula.
      </div>

      <div className="access-setup-grid">
        <section className="panel access-create-card">
          <div className="panel-head">
            <div>
              <span className="access-step">1</span>
              <h2>Fazer matrícula e liberar a família</h2>
              <p>Preencha os dados do aluno, responsável, professor e plano. O acesso é criado sem duplicar o cadastro.</p>
            </div>
          </div>

          <form action={createGuardianEnrollment} className="form-stack">
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <div className="form-row">
              <div className="field">
                <label>Nome do responsável *</label>
                <input className="input" name="fullName" required />
              </div>
              <div className="field">
                <label>Como prefere ser chamado</label>
                <input className="input" name="preferredName" />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>E-mail do responsável *</label>
                <input className="input" type="email" name="email" required />
              </div>
              <div className="field">
                <label>WhatsApp</label>
                <input className="input" name="phone" />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Nome do aluno *</label>
                <input className="input" name="childName" required />
              </div>
              <div className="field">
                <label>Nome usado no portal</label>
                <input className="input" name="childPreferredName" />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Ano escolar</label>
                <select className="select" name="gradeId" defaultValue="">
                  <option value="">Selecionar</option>
                  {(grades ?? []).map((grade: any) => (
                    <option key={grade.id} value={grade.id}>{grade.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Escola</label>
                <input className="input" name="schoolName" />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Professor *</label>
                <select className="select" name="teacherId" required defaultValue="">
                  <option value="" disabled>Selecionar professor</option>
                  {(teachers ?? []).map((teacher: any) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.profiles?.preferred_name || teacher.profiles?.full_name || "Professor"}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Plano *</label>
                <select className="select" name="planId" required defaultValue="">
                  <option value="" disabled>Selecionar plano</option>
                  {(plans ?? []).map((plan: any) => (
                    <option key={plan.id} value={plan.id}>{plan.name} • {money(plan.monthly_price)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Vínculo com a criança</label>
              <input className="input" name="relationship" defaultValue="Responsável" />
            </div>
            <EnrollmentSubmitButton />
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="access-step access-step-pink">2</span>
              <h2>Acessos e matrículas</h2>
              <p>Uma matrícula só aparece como finalizada quando professor e plano também foram vinculados.</p>
            </div>
          </div>

          {invitations?.length ? (
            <div className="form-stack">
              {invitations.map((invite: any) => (
                <article className="access-invite-card" key={invite.id}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <strong>{invite.full_name}</strong>
                      <p>{invite.email}</p>
                    </div>
                    <div className="flex gap-8 wrap">
                      <Badge tone={statusTone(invite.status)}>{statusLabel(invite.status)}</Badge>
                      <Badge tone={invite.enrollment_finalized_at ? "green" : "yellow"}>{invite.enrollment_finalized_at ? "Matrícula finalizada" : "Vínculos pendentes"}</Badge>
                    </div>
                  </div>
                  <small className="muted">
                    {invite.accepted_at
                      ? `Senha definida em ${dt(invite.accepted_at)}`
                      : invite.sent_at
                        ? `Enviado em ${dt(invite.sent_at)}`
                        : `Criado em ${dt(invite.created_at)}`}
                  </small>
                  {invite.enrollment_finalized_at && (
                    <p className="muted">
                      Professor: {invite.teachers?.profiles?.preferred_name || invite.teachers?.profiles?.full_name || "Vinculado"} • Plano: {invite.plans?.name || "Vinculado"}
                    </p>
                  )}
                  {invite.last_error && <p className="form-message form-error">{invite.last_error}</p>}

                  <div className="plan-admin-actions">
                    {invite.student_id && (
                      <details className="plan-editor">
                        <summary className="button button-secondary button-small">Editar professor / plano</summary>
                        <form action={updateEnrollmentAssignments} className="form-stack compact-form">
                          <input type="hidden" name="invitationId" value={invite.id} />
                          <div className="field">
                            <label>Professor</label>
                            <select className="select" name="teacherId" defaultValue={invite.teacher_id || ""} required>
                              <option value="" disabled>Selecionar professor</option>
                              {(teachers ?? []).map((teacher: any) => (
                                <option key={teacher.id} value={teacher.id}>{teacher.profiles?.preferred_name || teacher.profiles?.full_name || "Professor"}</option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>Plano</label>
                            <select className="select" name="planId" defaultValue={invite.plan_id || ""} required>
                              <option value="" disabled>Selecionar plano</option>
                              {(plans ?? []).map((plan: any) => (
                                <option key={plan.id} value={plan.id}>{plan.name} • {money(plan.monthly_price)}</option>
                              ))}
                            </select>
                          </div>
                          <button className="button button-secondary button-small" type="submit">Salvar sem recriar matrícula</button>
                        </form>
                      </details>
                    )}
                    {!['accepted', 'cancelled'].includes(invite.status) && (
                      <form action={resendGuardianInvitation}>
                        <input type="hidden" name="invitationId" value={invite.id} />
                        <button className="button button-secondary button-small" type="submit">Reenviar link</button>
                      </form>
                    )}
                    {!['accepted', 'cancelled'].includes(invite.status) && (
                      <form action={cancelGuardianInvitation}>
                        <input type="hidden" name="invitationId" value={invite.id} />
                        <button className="button button-ghost button-small" type="submit">Cancelar</button>
                      </form>
                    )}
                    <details className="plan-editor">
                      <summary className="button button-danger button-small">Excluir</summary>
                      <form action={moveGuardianInvitationToTrash} className="form-stack compact-form">
                        <input type="hidden" name="invitationId" value={invite.id} />
                        <div className="field">
                          <label>Motivo opcional</label>
                          <input className="input" name="reason" placeholder="Ex.: duplicação por clique" />
                        </div>
                        <button className="button button-danger button-small" type="submit">Enviar para a Lixeira</button>
                      </form>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum acesso de família enviado" description="As matrículas criadas pelo Admin aparecerão aqui." />
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Interesses recebidos pelo site</h2>
            <p>São solicitações de contato e não criam conta automaticamente.</p>
          </div>
        </div>
        {requests?.length ? (
          <div className="form-stack">
            {requests.map((item: any) => (
              <article className="mission-card" key={item.id}>
                <div className="flex space-between gap-8 wrap">
                  <div>
                    <strong>{item.guardian_name}</strong>
                    <p>{item.child_name || "Criança não informada"} • {item.grades?.name || "Ano não informado"}</p>
                  </div>
                  <Badge tone={item.status === "new" ? "yellow" : "blue"}>{item.status}</Badge>
                </div>
                <small className="muted">{item.email} • {item.phone_whatsapp} • {dt(item.created_at)}</small>
                <details className="plan-editor mt-12">
                  <summary className="button button-danger button-small">Excluir solicitação</summary>
                  <form action={moveEnrollmentRequestToTrash} className="form-stack compact-form">
                    <input type="hidden" name="requestId" value={item.id} />
                    <div className="field">
                      <label>Motivo opcional</label>
                      <input className="input" name="reason" placeholder="Ex.: solicitação duplicada" />
                    </div>
                    <button className="button button-danger button-small" type="submit">Enviar para a Lixeira</button>
                  </form>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhuma solicitação" description="Novos interesses enviados pelo site aparecerão aqui." />
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Editar dados do aluno</h2>
            <p>A matrícula criada não precisa ser refeita para corrigir nome, escola ou ano escolar.</p>
          </div>
        </div>
        <a className="button button-secondary" href="/admin/alunos">Abrir dados acadêmicos do aluno</a>
      </section>
    </>
  );
}
