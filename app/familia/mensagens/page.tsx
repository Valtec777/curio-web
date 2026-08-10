import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { sendFamilyChatMessage } from "@/app/familia/actions";
import { getFamilyPortal } from "@/lib/family";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

export default async function FamilyMessagesPage({ searchParams }: { searchParams: Promise<{ aluno?: string; conversa?: string; erro?: string }> }) {
  const query = await searchParams;
  const { selectedChild, supabase, viewer } = await getFamilyPortal(query.aluno || null);
  if (!selectedChild) return <EmptyState title="Nenhuma criança vinculada" description="As conversas aparecerão depois que houver uma criança vinculada." />;

  const [{ data: targets }, { data: participantRows }] = await Promise.all([
    supabase.rpc("guardian_chat_targets"),
    supabase
      .from("message_thread_participants")
      .select("thread_id,user_id,last_read_at,message_threads(id,subject,thread_type,updated_at,context_student_id)")
      .eq("user_id", viewer.user.id)
      .order("joined_at", { ascending: false })
      .limit(80),
  ]);

  const childTargets = (Array.isArray(targets) ? targets : []).filter((target: any) => target.student_id === selectedChild.student_id);
  const threads = (participantRows ?? []).map((row: any) => row.message_threads).filter((thread: any) => thread?.context_student_id === selectedChild.student_id && thread.thread_type === "family");
  const threadIds = threads.map((thread: any) => thread.id);
  const [{ data: allParticipants }, { data: messages }] = await Promise.all([
    threadIds.length ? supabase.from("message_thread_participants").select("thread_id,user_id").in("thread_id", threadIds) : Promise.resolve({ data: [] as any[] }),
    threadIds.length ? supabase.from("messages").select("id,thread_id,sender_user_id,body,created_at,edited_at,action_label,action_url").in("thread_id", threadIds).is("deleted_at", null).order("created_at", { ascending: true }).limit(300) : Promise.resolve({ data: [] as any[] }),
  ]);

  const participantsByThread = new Map<string, string[]>();
  for (const row of allParticipants ?? []) {
    const list = participantsByThread.get(row.thread_id) || [];
    list.push(row.user_id);
    participantsByThread.set(row.thread_id, list);
  }
  const targetByUser = new Map(childTargets.map((target: any) => [target.teacher_user_id, target]));
  const threadInfo = threads.map((thread: any) => {
    const otherUser = (participantsByThread.get(thread.id) || []).find((id) => id !== viewer.user.id);
    const teacher = otherUser ? targetByUser.get(otherUser) : null;
    return { ...thread, teacher, isTeacherChat: Boolean(teacher) };
  }).sort((a: any, b: any) => +new Date(b.updated_at) - +new Date(a.updated_at));

  const selectedThread = threadInfo.find((thread: any) => thread.id === query.conversa) || threadInfo.find((thread: any) => thread.isTeacherChat) || threadInfo[0] || null;
  const selectedMessages = selectedThread ? (messages ?? []).filter((message: any) => message.thread_id === selectedThread.id) : [];

  return (
    <>
      <PageHeader
        eyebrow="Ninho da Família"
        title={`Mensagens · ${selectedChild.student_name}`}
        description={`Converse com ${selectedChild.teacher_name ? `o professor(a) ${selectedChild.teacher_name}` : "o professor vinculado"} sobre o acompanhamento.`}
        action={<a className="button button-primary" href="#nova-conversa">+ Nova conversa</a>}
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}

      <section id="nova-conversa" className="panel family-highlight">
        <div className="panel-head"><div><h2>Iniciar conversa com o professor</h2><p>Somente professores vinculados a {selectedChild.student_name} aparecem aqui.</p></div></div>
        {childTargets.length ? (
          <form action={sendFamilyChatMessage} className="form-stack">
            <input type="hidden" name="studentId" value={selectedChild.student_id} />
            <input type="hidden" name="requestKey" value={`family-chat-${randomUUID()}`} />
            <div className="field"><label>Professor</label><select className="select" name="teacherId" defaultValue={childTargets[0].teacher_id}>{childTargets.map((target: any) => <option value={target.teacher_id} key={`${target.student_id}-${target.teacher_id}`}>{target.teacher_name}</option>)}</select></div>
            <div className="field"><label>Mensagem</label><textarea className="textarea textarea-compact" name="body" required placeholder="Escreva sua mensagem..." /></div>
            <button className="button button-primary" type="submit">Iniciar conversa</button>
          </form>
        ) : <EmptyState title="Professor ainda não vinculado" description="Assim que houver um professor responsável por esta criança, ele aparecerá para iniciar a conversa." />}
      </section>

      <section className="family-chat-shell">
        <aside className="family-chat-list">
          <strong>Conversas</strong>
          <div className="mt-12">
            {threadInfo.length ? threadInfo.map((thread: any) => (
              <Link
                className={selectedThread?.id === thread.id ? "is-active" : ""}
                href={`/familia/mensagens?aluno=${selectedChild.student_id}&conversa=${thread.id}`}
                key={thread.id}
              >
                <strong>{thread.isTeacherChat ? thread.teacher?.teacher_name : "Recado CURIÓ"}</strong>
                <small>{thread.subject || (thread.isTeacherChat ? `Conversa sobre ${selectedChild.student_name}` : "Mensagem administrativa")}</small>
              </Link>
            )) : <p className="muted">Nenhuma conversa ainda.</p>}
          </div>
        </aside>

        <div className="family-chat-main">
          {selectedThread ? (
            <>
              <div className="family-chat-messages">
                <div className="flex space-between gap-8 wrap">
                  <div><strong>{selectedThread.isTeacherChat ? selectedThread.teacher?.teacher_name : "Recado CURIÓ"}</strong><small className="muted"> · {selectedChild.student_name}</small></div>
                  <Badge tone={selectedThread.isTeacherChat ? "green" : "blue"}>{selectedThread.isTeacherChat ? "Conversa" : "Informativo"}</Badge>
                </div>
                {selectedMessages.length ? selectedMessages.map((message: any) => (
                  <div className={`family-chat-bubble${message.sender_user_id === viewer.user.id ? " is-own" : ""}`} key={message.id}>
                    <p>{message.body}</p>
                    <small>{message.sender_user_id === viewer.user.id ? "Você" : selectedThread.isTeacherChat ? selectedThread.teacher?.teacher_name : "Equipe CURIÓ"} · {dt(message.created_at)}{message.edited_at ? " · editada" : ""}</small>
                    {message.action_label && message.action_url ? <div className="mt-8"><a className="button button-secondary button-small" href={message.action_url} target={message.action_url.startsWith("https://") ? "_blank" : undefined} rel={message.action_url.startsWith("https://") ? "noreferrer" : undefined}>{message.action_label}</a></div> : null}
                  </div>
                )) : <p className="muted">A conversa ainda não tem mensagens.</p>}
              </div>

              {selectedThread.isTeacherChat ? (
                <form action={sendFamilyChatMessage} className="family-chat-compose">
                  <input type="hidden" name="threadId" value={selectedThread.id} />
                  <input type="hidden" name="studentId" value={selectedChild.student_id} />
                  <input type="hidden" name="requestKey" value={`family-reply-${randomUUID()}`} />
                  <input className="input" name="body" required placeholder="Digite uma mensagem..." aria-label="Mensagem" />
                  <button className="button button-primary" type="submit">Enviar</button>
                </form>
              ) : <div className="notice" style={{ margin: 14 }}>Este é um recado administrativo do CURIÓ. Para conversar sobre a criança, use uma conversa com o professor vinculado.</div>}
            </>
          ) : <div className="family-chat-messages"><EmptyState title="Nenhuma conversa" description="Use “Nova conversa” para iniciar um chat com o professor da criança." /></div>}
        </div>
      </section>
    </>
  );
}
