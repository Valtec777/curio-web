import { randomUUID } from "node:crypto";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendAdminFamilyMessage } from "./actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const viewer = await requireRole("admin");
  const supabase = await createClient();

  const [{ data: links }, { data: sentMessages }] = await Promise.all([
    supabase
      .from("guardian_students")
      .select("guardian_id,student_id,relationship,guardians(id,active,profiles(full_name,preferred_name)),students(id,full_name,preferred_name,deleted_at)")
      .order("created_at", { ascending: false })
      .limit(160),
    supabase
      .from("messages")
      .select("id,body,action_label,action_url,created_at,message_threads(subject,context_student_id)")
      .eq("sender_user_id", viewer.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const recipients = (links ?? []).filter((link: any) => link.guardians?.active && !link.students?.deleted_at);

  return (
    <>
      <PageHeader
        eyebrow="Admin • Operação"
        title="Mensagens"
        description="Escolha uma família vinculada à criança e envie a mensagem diretamente. A conversa fica registrada no CURIÓ."
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="panel">
        <div className="panel-head"><div><h2>Famílias</h2><p>O vínculo com a criança define exatamente quem pode receber a conversa.</p></div></div>
        {recipients.length ? (
          <div className="people-admin-grid">
            {recipients.map((link: any) => (
              <article className="person-admin-card" key={`${link.guardian_id}-${link.student_id}`}>
                <div className="flex space-between gap-8 wrap">
                  <div>
                    <h3>{link.guardians?.profiles?.preferred_name || link.guardians?.profiles?.full_name || "Responsável"}</h3>
                    <p>{link.students?.preferred_name || link.students?.full_name || "Criança"} • {link.relationship || "Responsável"}</p>
                  </div>
                  <Badge tone="green">Pode receber mensagem</Badge>
                </div>
                <details className="plan-editor">
                  <summary className="button button-primary button-small">Enviar mensagem</summary>
                  <form action={sendAdminFamilyMessage} className="form-stack compact-form">
                    <input type="hidden" name="studentId" value={link.student_id} />
                    <input type="hidden" name="guardianId" value={link.guardian_id} />
                    <input type="hidden" name="requestKey" value={`admin-family-message:${randomUUID()}`} />
                    <div className="field"><label>Assunto</label><input className="input" name="subject" placeholder="Ex.: Sobre a próxima aula" required /></div>
                    <div className="field"><label>Mensagem</label><textarea className="textarea" name="body" placeholder="Escreva a mensagem para a família." required /></div>
                    <div className="form-row">
                      <div className="field"><label>Texto do botão <span className="field-optional">opcional</span></label><input className="input" name="actionLabel" placeholder="Ex.: Ver agenda" /></div>
                      <div className="field"><label>Destino do botão</label><input className="input" name="actionUrl" placeholder="/familia/agenda ou https://..." /></div>
                    </div>
                    <button className="button button-primary button-small" type="submit">Enviar para a família</button>
                  </form>
                </details>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Nenhuma família vinculada" description="Quando houver responsáveis vinculados a crianças, eles aparecerão aqui." />}
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Mensagens enviadas pelo Admin</h2><p>Histórico recente das conversas iniciadas por esta conta.</p></div></div>
        {sentMessages?.length ? (
          <div className="form-stack">
            {sentMessages.map((message: any) => (
              <article className="mission-card" key={message.id}>
                <div className="flex space-between gap-8 wrap"><strong>{message.message_threads?.subject || "Conversa CURIÓ"}</strong><small className="muted">{dt(message.created_at)}</small></div>
                <p>{message.body}</p>
                {message.action_url && message.action_label && <a href={message.action_url}>{message.action_label} →</a>}
              </article>
            ))}
          </div>
        ) : <EmptyState title="Nenhuma mensagem enviada" description="As mensagens enviadas pelo Admin aparecerão aqui." />}
      </section>
    </>
  );
}
