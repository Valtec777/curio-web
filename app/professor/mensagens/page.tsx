import { randomUUID } from "node:crypto";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { FamilyMessageComposer } from "./composer";
import { editTeamMessage, removeTeamMessage } from "@/app/message-actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

export default async function ProfessorMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) {
    return <EmptyState title="Perfil de professor ainda não vinculado" description="A administração precisa concluir seu perfil antes de enviar mensagens." />;
  }

  const [
    { data: studentLinks },
    { data: guardianRows },
    { data: templates },
    { data: sentMessages },
  ] = await Promise.all([
    supabase
      .from("teacher_students")
      .select("student_id,students(id,preferred_name,full_name,school_name,deleted_at,grades(name))")
      .eq("teacher_id", teacher.id)
      .eq("active", true),
    supabase.rpc("teacher_linked_guardian_names"),
    supabase
      .from("content_templates")
      .select("id,name,description,config")
      .eq("template_type", "communication")
      .eq("active", true)
      .order("name"),
    supabase
      .from("messages")
      .select("id,thread_id,body,created_at,edited_at,action_label,action_url,message_threads(subject,context_student_id)")
      .eq("sender_user_id", viewer.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const studentMap = new Map(
    (studentLinks ?? [])
      .filter((link: any) => link.students && !link.students.deleted_at)
      .map((link: any) => [link.student_id, link.students]),
  );

  const targets = (guardianRows ?? [])
    .map((guardian: any) => {
      const student: any = studentMap.get(guardian.student_id);
      if (!student) return null;
      return {
        studentId: guardian.student_id,
        studentName: student.preferred_name || student.full_name || "Aluno",
        guardianId: guardian.guardian_id,
        guardianName: guardian.guardian_name || "Responsável",
        relationship: guardian.relationship || "Responsável",
        schoolName: student.school_name || "",
        gradeName: student.grades?.name || "",
      };
    })
    .filter(Boolean) as Array<{
      studentId: string;
      studentName: string;
      guardianId: string;
      guardianName: string;
      relationship: string;
      schoolName: string;
      gradeName: string;
    }>;

  const messageTemplates = (templates ?? []).map((template: any) => ({
    id: template.id,
    name: template.name,
    description: template.description || "",
    subject: String(template.config?.subject || ""),
    body: String(template.config?.body || ""),
    actionLabel: String(template.config?.action_label || ""),
    actionUrl: String(template.config?.action_url || ""),
  }));

  const studentName = new Map(
    [...studentMap.entries()].map(([id, student]: any) => [id, student.preferred_name || student.full_name || "Aluno"]),
  );

  return (
    <>
      <PageHeader
        eyebrow="Professor • Mensagens"
        title="Mensagens"
        description="Envie mensagens internas para famílias vinculadas, com modelos CURIÓ, variáveis e preview antes do envio."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="notice">
        O envio acontece dentro do CURIÓ. Nenhum WhatsApp, e-mail ou serviço externo é acionado por esta tela. O backend valida novamente o vínculo Professor → Aluno → Família antes de salvar a mensagem.
      </div>

      <FamilyMessageComposer
        targets={targets}
        templates={messageTemplates}
        teacherName={viewer.profile?.preferred_name || viewer.profile?.full_name || "Professor CURIÓ"}
        requestKey={randomUUID()}
      />

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Mensagens enviadas</h2>
            <p>Edite ou remova somente mensagens que você enviou. A remoção preserva o histórico operacional.</p>
          </div>
        </div>

        {sentMessages?.length ? (
          <div className="form-stack">
            {sentMessages.map((message: any) => (
              <article className="mission-card" key={message.id}>
                <div className="flex space-between gap-8 wrap">
                  <div>
                    <strong>{message.message_threads?.subject || "Conversa CURIÓ"}</strong>
                    <p>{message.body}</p>
                  </div>
                  <Badge tone="blue">{studentName.get(message.message_threads?.context_student_id) || "Família"}</Badge>
                </div>
                <small className="muted">{dt(message.created_at)}{message.edited_at ? " • editada" : ""}</small>
                {message.action_label && message.action_url && (
                  <p className="muted">Botão: {message.action_label} → {message.action_url}</p>
                )}
                <details className="plan-editor mt-12">
                  <summary className="button button-secondary button-small">Editar mensagem</summary>
                  <form action={editTeamMessage} className="form-stack compact-form">
                    <input type="hidden" name="messageId" value={message.id} />
                    <input type="hidden" name="returnPath" value="/professor/mensagens" />
                    <textarea className="textarea" name="body" defaultValue={message.body} required maxLength={5000} />
                    <button className="button button-secondary button-small" type="submit">Salvar edição</button>
                  </form>
                </details>
                <form action={removeTeamMessage} className="mt-12">
                  <input type="hidden" name="messageId" value={message.id} />
                  <input type="hidden" name="returnPath" value="/professor/mensagens" />
                  <button className="button button-danger button-small" type="submit">Remover mensagem</button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhuma mensagem enviada" description="Use o compositor acima para iniciar uma conversa com uma família vinculada." />
        )}
      </section>
    </>
  );
}
