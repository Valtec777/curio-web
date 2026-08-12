import { randomUUID } from "node:crypto";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { sendTeacherChatMessage } from "./actions";

const THREAD_LIMIT = 80;
const MESSAGE_PAGE_SIZE = 50;
const PREVIEW_LIMIT = 160;
const ADMIN_NOTICE_LIMIT = 40;

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
  searchParams: Promise<{ conversa?: string; erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil de professor ainda não vinculado" description="A administração precisa concluir seu perfil antes de usar as conversas." />;

  const [{ data: targets }, { data: ownParticipantRows }] = await Promise.all([
    supabase.rpc("teacher_chat_targets"),
    supabase
      .from("message_thread_participants")
      .select("thread_id,last_read_at,message_threads(id,subject,thread_type,updated_at,context_student_id)")
      .eq("user_id", viewer.user.id)
      .order("joined_at", { ascending: false })
      .limit(THREAD_LIMIT),
  ]);

  const threads = (ownParticipantRows ?? []).map((row: any) => ({ ...row.message_threads, participantMeta: row })).filter((thread: any) => thread?.id);
  const conversations = threads.filter((thread: any) => thread.thread_type === "family" || thread.thread_type === "student");
  const adminThreads = threads.filter((thread: any) => thread.thread_type !== "family" && thread.thread_type !== "student");
  const threadIds = threads.map((thread: any) => thread.id);
  const conversationIds = new Set(conversations.map((thread: any) => thread.id));
  const selectedId = query.conversa && conversationIds.has(query.conversa) ? query.conversa : conversations[0]?.id || "";
  const selectedThread: any = conversations.find((thread: any) => thread.id === selectedId);
  const conversationIdList = conversations.map((thread: any) => thread.id);
  const adminThreadIds = adminThreads.map((thread: any) => thread.id);

  const [
    { data: participantRows },
    { data: previewMessages },
    { data: selectedMessagesDesc },
    { data: adminMessagesDesc },
  ] = await Promise.all([
    threadIds.length
      ? supabase.from("message_thread_participants").select("thread_id,user_id").in("thread_id", threadIds)
      : Promise.resolve({ data: [] as any[] }),
    conversationIdList.length
      ? supabase
        .from("messages")
        .select("id,thread_id,body,created_at")
        .in("thread_id", conversationIdList)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(PREVIEW_LIMIT)
      : Promise.resolve({ data: [] as any[] }),
    selectedId
      ? supabase
        .from("messages")
        .select("id,thread_id,sender_user_id,body,created_at,edited_at,action_label,action_url")
        .eq("thread_id", selectedId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE)
      : Promise.resolve({ data: [] as any[] }),
    adminThreadIds.length
      ? supabase
        .from("messages")
        .select("id,thread_id,sender_user_id,body,created_at,action_label,action_url")
        .in("thread_id", adminThreadIds)
        .neq("sender_user_id", viewer.user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(ADMIN_NOTICE_LIMIT)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const participantsByThread = new Map<string, string[]>();
  for (const row of participantRows ?? []) {
    const current = participantsByThread.get(row.thread_id) ?? [];
    current.push(row.user_id);
    participantsByThread.set(row.thread_id, current);
  }

  const latestMessageByThread = new Map<string, any>();
  for (const message of previewMessages ?? []) {
    if (!latestMessageByThread.has(message.thread_id)) latestMessageByThread.set(message.thread_id, message);
  }

  function targetForThread(thread: any) {
    const otherUserId = (participantsByThread.get(thread.id) || []).find((userId) => userId !== viewer.user.id);
    return (targets ?? []).find((target: any) => target.target_user_id === otherUserId && target.student_id === thread.context_student_id) || null;
  }

  function threadTitle(thread: any) {
    const target: any = targetForThread(thread);
    if (target?.target_kind === "family") return `${target.target_name} · família de ${target.student_name}`;
    if (target?.target_kind === "student") return target.target_name;
    return thread.subject || "Conversa";
  }

  function threadDetail(thread: any) {
    const target: any = targetForThread(thread);
    if (target?.target_kind === "family") return `${target.relationship || "Responsável"} · ${target.student_name}`;
    if (target?.target_kind === "student") return `Aluno · ${target.student_name}`;
    return thread.thread_type;
  }

  const selectedMessages = [...(selectedMessagesDesc ?? [])].reverse();
  const adminThreadById = new Map(adminThreads.map((thread: any) => [thread.id, thread]));
  const adminMessages = (adminMessagesDesc ?? []).map((message: any) => ({
    ...message,
    subject: adminThreadById.get(message.thread_id)?.subject || "Recado da administração",
  }));

  return (
    <>
      <PageHeader
        eyebrow="Professor • Mensagens"
        title="Mensagens"
        description="Converse normalmente com famílias e alunos vinculados. Comunicados administrativos aparecem separados e não viram um chat comum."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="teacher-chat-layout">
        <section className="panel">
          <div className="panel-head"><div><h2>Conversas</h2><p>Famílias e alunos vinculados a você.</p></div></div>

          <details className="plan-editor mb-16">
            <summary className="button button-primary button-small">+ Nova conversa</summary>
            <form action={sendTeacherChatMessage} className="form-stack compact-form mt-12">
              <input type="hidden" name="requestKey" value={randomUUID()} />
              <div className="field">
                <label>Conversar com *</label>
                <select className="select" name="target" defaultValue="" required>
                  <option value="" disabled>Selecione</option>
                  {(targets ?? []).map((target: any) => (
                    <option key={`${target.target_kind}-${target.student_id}-${target.target_user_id}`} value={`${target.target_kind}|${target.student_id}|${target.guardian_id || ""}`}>
                      {target.target_kind === "family" ? `Família de ${target.student_name} — ${target.target_name}${target.relationship ? ` (${target.relationship})` : ""}` : `Aluno — ${target.target_name}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field"><label>Primeira mensagem *</label><textarea className="textarea textarea-compact" name="body" required maxLength={5000} /></div>
              <button className="button button-primary button-small" type="submit">Iniciar conversa</button>
            </form>
          </details>

          {conversations.length ? (
            <div className="teacher-chat-list">
              {conversations.map((thread: any) => {
                const last = latestMessageByThread.get(thread.id);
                return (
                  <Link className={`teacher-chat-thread${thread.id === selectedId ? " is-active" : ""}`} href={`/professor/mensagens?conversa=${thread.id}`} key={thread.id}>
                    <strong>{threadTitle(thread)}</strong>
                    <small>{threadDetail(thread)}</small>
                    <small>{last?.body ? `${last.body.slice(0, 62)}${last.body.length > 62 ? "…" : ""}` : "Conversa iniciada"}</small>
                  </Link>
                );
              })}
            </div>
          ) : <EmptyState title="Nenhuma conversa" description="Clique em “Nova conversa” para falar com uma família ou aluno vinculado." />}
        </section>

        {selectedThread ? (
          <section className="panel teacher-chat-window">
            <header className="teacher-chat-head">
              <h2>{threadTitle(selectedThread)}</h2>
              <p>{threadDetail(selectedThread)}</p>
            </header>
            <div className="teacher-chat-messages">
              {selectedMessages.length ? selectedMessages.map((message: any) => {
                const isOwn = message.sender_user_id === viewer.user.id;
                return (
                  <div className={`teacher-chat-bubble${isOwn ? " is-own" : ""}`} key={message.id}>
                    <p>{message.body}</p>
                    <small>{isOwn ? "Você" : threadTitle(selectedThread)} · {dt(message.created_at)}{message.edited_at ? " · editada" : ""}</small>
                    {message.action_label && message.action_url && <a className="button button-secondary button-small mt-12" href={message.action_url} target={message.action_url.startsWith("https://") ? "_blank" : undefined} rel={message.action_url.startsWith("https://") ? "noreferrer" : undefined}>{message.action_label}</a>}
                  </div>
                );
              }) : <p className="muted">Ainda não há mensagens nesta conversa.</p>}
              {selectedMessages.length === MESSAGE_PAGE_SIZE && <small className="muted">Mostrando as {MESSAGE_PAGE_SIZE} mensagens mais recentes desta conversa.</small>}
            </div>
            <form action={sendTeacherChatMessage} className="teacher-chat-compose">
              <input type="hidden" name="threadId" value={selectedThread.id} />
              <input type="hidden" name="requestKey" value={randomUUID()} />
              <textarea className="textarea" name="body" placeholder="Escreva uma mensagem…" required maxLength={5000} aria-label="Mensagem" />
              <button className="button button-primary" type="submit">Enviar</button>
            </form>
          </section>
        ) : (
          <section className="panel"><EmptyState title="Escolha uma conversa" description="Quando você iniciar ou abrir um chat, as mensagens aparecerão aqui." /></section>
        )}
      </div>

      <section className="panel mt-16">
        <div className="panel-head"><div><h2>Recados da administração</h2><p>Comunicados do Admin aparecem aqui como mensagens informativas, separados das conversas com alunos e famílias.</p></div></div>
        {adminMessages.length ? (
          <div className="teacher-admin-notice-list">
            {adminMessages.map((message: any) => (
              <article className="teacher-admin-notice" key={message.id}>
                <strong>{message.subject}</strong>
                <p>{message.body}</p>
                <small className="muted">{dt(message.created_at)}</small>
                {message.action_label && message.action_url && <div className="mt-12"><a className="button button-secondary button-small" href={message.action_url} target={message.action_url.startsWith("https://") ? "_blank" : undefined} rel={message.action_url.startsWith("https://") ? "noreferrer" : undefined}>{message.action_label}</a></div>}
              </article>
            ))}
          </div>
        ) : <p className="muted">Nenhum recado administrativo no momento.</p>}
      </section>
    </>
  );
}
