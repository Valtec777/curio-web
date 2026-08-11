import { randomUUID } from "node:crypto";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminFamilyMessageComposer } from "./composer";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function one<T = any>(value: any): T | null {
  return (Array.isArray(value) ? value[0] : value) || null;
}

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const viewer = await requireRole("admin");
  const supabase = await createClient();

  const [{ data: links }, { data: teacherLinks }, { data: templateRows }, { data: sentMessages }] = await Promise.all([
    supabase
      .from("guardian_students")
      .select("guardian_id,student_id,relationship,guardians(id,active,profiles(full_name,preferred_name)),students(id,full_name,preferred_name,deleted_at)")
      .order("created_at", { ascending: false })
      .limit(160),
    supabase
      .from("teacher_students")
      .select("student_id,teachers(active,profiles(full_name,preferred_name))")
      .eq("active", true),
    supabase
      .from("content_templates")
      .select("id,name,description,config")
      .eq("template_type", "communication")
      .eq("shared", true)
      .eq("active", true)
      .order("name"),
    supabase
      .from("messages")
      .select("id,body,action_label,action_url,created_at,message_threads(subject,context_student_id)")
      .eq("sender_user_id", viewer.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const teacherByStudent = new Map<string, string>();
  for (const row of teacherLinks ?? []) {
    const teacher: any = one((row as any).teachers);
    const profile: any = one(teacher?.profiles);
    if (teacher?.active && !teacherByStudent.has((row as any).student_id)) {
      teacherByStudent.set((row as any).student_id, profile?.preferred_name || profile?.full_name || "");
    }
  }

  const templates = (templateRows ?? []).flatMap((row: any) => {
    const config = row.config && typeof row.config === "object" ? row.config : {};
    if (config.context_kind) return [];
    return [{
      id: row.id,
      name: row.name,
      description: row.description || "",
      subject: String(config.subject || ""),
      body: String(config.body || ""),
      actionLabel: String(config.action_label || ""),
      actionUrl: String(config.action_url || ""),
    }];
  });

  const recipients = (links ?? []).flatMap((link: any) => {
    const guardian: any = one(link.guardians);
    const guardianProfile: any = one(guardian?.profiles);
    const student: any = one(link.students);
    if (!guardian?.active || !student || student.deleted_at) return [];
    return [{
      guardianId: link.guardian_id,
      studentId: link.student_id,
      relationship: link.relationship || "Responsável",
      guardianName: guardianProfile?.preferred_name || guardianProfile?.full_name || "Responsável",
      studentName: student.preferred_name || student.full_name || "Criança",
      teacherName: teacherByStudent.get(link.student_id) || "",
    }];
  });

  return (
    <>
      <PageHeader
        eyebrow="Admin • Operação"
        title="Mensagens"
        description="Escolha uma família vinculada à criança e envie uma mensagem personalizada ou use um modelo pronto. A conversa fica registrada no CURIÓ."
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="panel">
        <div className="panel-head"><div><h2>Famílias</h2><p>O vínculo com a criança define exatamente quem pode receber a conversa. Variáveis dos modelos são validadas novamente no servidor antes do envio.</p></div></div>
        {recipients.length ? (
          <div className="people-admin-grid">
            {recipients.map((recipient: any) => (
              <article className="person-admin-card" key={`${recipient.guardianId}-${recipient.studentId}`}>
                <div className="flex space-between gap-8 wrap">
                  <div>
                    <h3>{recipient.guardianName}</h3>
                    <p>{recipient.studentName} • {recipient.relationship}</p>
                  </div>
                  <Badge tone="green">Pode receber mensagem</Badge>
                </div>
                <details className="plan-editor">
                  <summary className="button button-primary button-small">Enviar mensagem</summary>
                  <AdminFamilyMessageComposer
                    studentId={recipient.studentId}
                    studentName={recipient.studentName}
                    guardianId={recipient.guardianId}
                    guardianName={recipient.guardianName}
                    teacherName={recipient.teacherName}
                    requestKey={`admin-family-message:${randomUUID()}`}
                    templates={templates}
                  />
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
            {sentMessages.map((message: any) => {
              const thread: any = one(message.message_threads);
              return (
                <article className="mission-card" key={message.id}>
                  <div className="flex space-between gap-8 wrap"><strong>{thread?.subject || "Conversa CURIÓ"}</strong><small className="muted">{dt(message.created_at)}</small></div>
                  <p>{message.body}</p>
                  {message.action_url && message.action_label && <a href={message.action_url}>{message.action_label} →</a>}
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Nenhuma mensagem enviada" description="As mensagens enviadas pelo Admin aparecerão aqui." />}
      </section>
    </>
  );
}
