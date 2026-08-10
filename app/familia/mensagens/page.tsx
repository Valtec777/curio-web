import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

export default async function FamilyMessagesPage() {
  const viewer = await requireRole("guardian");
  const supabase = await createClient();

  const { data: participantRows } = await supabase
    .from("message_thread_participants")
    .select("thread_id,last_read_at,message_threads(id,subject,thread_type,updated_at,context_student_id)")
    .eq("user_id", viewer.user.id)
    .order("joined_at", { ascending: false })
    .limit(60);

  const threadIds = (participantRows ?? []).map((item: any) => item.thread_id);
  const studentIds = [...new Set((participantRows ?? []).map((item: any) => item.message_threads?.context_student_id).filter(Boolean))];

  const [{ data: messages }, { data: students }] = await Promise.all([
    threadIds.length
      ? supabase
          .from("messages")
          .select("id,thread_id,sender_user_id,body,created_at,edited_at,action_label,action_url")
          .in("thread_id", threadIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(120)
      : Promise.resolve({ data: [] as any[] }),
    studentIds.length
      ? supabase.from("students").select("id,preferred_name,full_name").in("id", studentIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const studentName = new Map((students ?? []).map((student: any) => [student.id, student.preferred_name || student.full_name || "Aluno"]));
  const threadMap = new Map((participantRows ?? []).map((item: any) => [item.thread_id, item.message_threads]));

  return (
    <>
      <PageHeader
        eyebrow="Ninho da Família"
        title="Mensagens"
        description="Recados da equipe e dos professores do CURIÓ, com ações ligadas à agenda e às atividades quando necessário."
      />

      <div className="notice">
        As mensagens desta área são internas ao CURIÓ. Botões podem abrir uma área do portal ou, quando indicado, um endereço HTTPS relacionado ao acompanhamento.
      </div>

      <section className="panel">
        {messages?.length ? (
          <div className="form-stack">
            {messages.map((message: any) => {
              const thread: any = threadMap.get(message.thread_id);
              const isOwn = message.sender_user_id === viewer.user.id;
              return (
                <article className="mission-card" key={message.id}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <strong>{thread?.subject || "Conversa CURIÓ"}</strong>
                      <p>{message.body}</p>
                    </div>
                    <Badge tone={isOwn ? "neutral" : "blue"}>{isOwn ? "Você" : "Equipe CURIÓ"}</Badge>
                  </div>
                  <small className="muted">
                    {thread?.context_student_id ? `${studentName.get(thread.context_student_id) || "Aluno"} • ` : ""}
                    {dt(message.created_at)}{message.edited_at ? " • editada" : ""}
                  </small>
                  {message.action_label && message.action_url && (
                    <div className="mt-12">
                      <a
                        className="button button-primary button-small"
                        href={message.action_url}
                        target={message.action_url.startsWith("https://") ? "_blank" : undefined}
                        rel={message.action_url.startsWith("https://") ? "noreferrer" : undefined}
                      >
                        {message.action_label}{message.action_url.startsWith("https://") ? " ↗" : ""}
                      </a>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Nenhuma mensagem ainda" description="Quando a equipe ou um professor enviar um recado para sua família, ele aparecerá aqui." />
        )}
      </section>
    </>
  );
}
