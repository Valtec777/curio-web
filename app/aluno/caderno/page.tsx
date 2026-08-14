import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { PrivateFamilyUploadForm } from "@/components/private-family-upload-form";
import { getCurrentStudent } from "@/lib/student";
import { submitStudentNotebook } from "./actions";

function dt(value?: string | null) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function label(item: any) {
  if (item.needs_redo) return "Para refazer";
  if (item.status === "reviewed") return "Corrigida";
  if (item.status === "submitted") return "Enviada";
  if (item.status === "in_progress") return "Em andamento";
  return "Pendente";
}

export default async function StudentNotebookPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { student, supabase, viaGuardian } = await getCurrentStudent();
  const { data: rows } = await supabase
    .from("notebook_assignments")
    .select("id,status,due_at,submitted_at,submission_photo_path,teacher_note,score,stars_awarded,needs_redo,redo_note,notebook_activities(id,title,description,worksheet_path,subjects(name))")
    .eq("student_id", student.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const worksheetUrls = new Map<string,string>();
  const submissionUrls = new Map<string,string>();
  for (const row of rows ?? []) {
    const activity: any = Array.isArray((row as any).notebook_activities) ? (row as any).notebook_activities[0] : (row as any).notebook_activities;
    if (activity?.worksheet_path) {
      const { data } = await supabase.storage.from("teacher-materials").createSignedUrl(activity.worksheet_path, 60 * 20);
      if (data?.signedUrl) worksheetUrls.set(row.id, data.signedUrl);
    }
    if (row.submission_photo_path) {
      const { data } = await supabase.storage.from("family-uploads").createSignedUrl(row.submission_photo_path, 60 * 20);
      if (data?.signedUrl) submissionUrls.set(row.id, data.signedUrl);
    }
  }

  const pending = (rows ?? []).filter((row: any) => ["assigned","in_progress"].includes(row.status) || row.needs_redo);
  const done = (rows ?? []).filter((row: any) => ["submitted","reviewed"].includes(row.status) && !row.needs_redo);

  const card = (row: any) => {
    const activity: any = Array.isArray(row.notebook_activities) ? row.notebook_activities[0] : row.notebook_activities;
    const subject: any = Array.isArray(activity?.subjects) ? activity.subjects[0] : activity?.subjects;
    const canSubmit = !viaGuardian && (["assigned","in_progress"].includes(row.status) || row.needs_redo);
    return <article className="student-notebook-card" key={row.id}>
      <div className="flex space-between gap-8 wrap">
        <div>
          <div className="flex gap-8 wrap"><Badge tone="purple">{subject?.name || "Caderno Curió"}</Badge><Badge tone={row.needs_redo ? "pink" : row.status === "reviewed" ? "green" : row.status === "submitted" ? "blue" : "yellow"}>{label(row)}</Badge></div>
          <h3>{activity?.title || "Atividade do Caderno Curió"}</h3>
          <p>{activity?.description || "Faça a atividade à mão e envie quando terminar."}</p>
        </div>
        {worksheetUrls.get(row.id) ? <a className="button button-secondary button-small" href={worksheetUrls.get(row.id)} target="_blank" rel="noreferrer">Baixar / abrir caderno ↗</a> : null}
      </div>
      <div className="student-resource-meta"><span>Prazo: {dt(row.due_at)}</span>{row.submitted_at ? <span>Enviado: {dt(row.submitted_at)}</span> : null}{row.score != null ? <span>Nota: {row.score}</span> : null}{row.stars_awarded ? <span>+{row.stars_awarded} ★</span> : null}</div>
      {row.needs_redo && row.redo_note ? <div className="student-feedback redo"><strong>Vamos tentar mais uma vez</strong><p>{row.redo_note}</p></div> : null}
      {row.teacher_note && !row.needs_redo ? <div className="student-feedback"><strong>Recado da professora</strong><p>{row.teacher_note}</p></div> : null}
      {submissionUrls.get(row.id) ? <a href={submissionUrls.get(row.id)} target="_blank" rel="noreferrer">Ver o arquivo que você enviou ↗</a> : null}
      {canSubmit ? <PrivateFamilyUploadForm action={submitStudentNotebook} studentId={student.id} kind="student-activity" fileField="activityFile" className="student-upload-box"><input type="hidden" name="assignmentId" value={row.id} /><label>{row.needs_redo ? "Enviar atividade refeita" : "Enviar foto ou PDF"}<input type="file" name="activityFile" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" required /></label><small className="muted">PDF ou imagem · até 15 MB · envio direto ao armazenamento privado.</small><button className="button button-primary button-small" type="submit">Enviar para a professora</button></PrivateFamilyUploadForm> : null}
      {viaGuardian && (["assigned","in_progress"].includes(row.status) || row.needs_redo) ? <small className="muted">Para enviar pelo responsável, volte ao Ninho da Família → Atividades.</small> : null}
    </article>;
  };

  return <>
    <PageHeader eyebrow="Explorador Curió" title="Meu Caderno Curió" description="Atividades que começam na tela e terminam no caderno. Escreva à mão, fotografe e envie quando terminar." />
    {query.erro && <div className="form-message form-error">{query.erro}</div>}
    {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
    <div className="student-metric-row"><div><strong>{pending.length}</strong><span>Pendentes</span></div><div><strong>{done.length}</strong><span>Enviadas / corrigidas</span></div><div><strong>{(rows ?? []).filter((r:any)=>r.needs_redo).length}</strong><span>Para refazer</span></div></div>
    <section className="panel"><div className="panel-head"><div><h2>Para fazer</h2><p>Abra o arquivo, faça no caderno e envie a foto ou PDF.</p></div></div>{pending.length ? <div className="student-notebook-list">{pending.map(card)}</div> : <EmptyState title="Tudo em dia por aqui" description="Quando a professora enviar uma atividade de caderno, ela aparecerá aqui." />}</section>
    <section className="panel"><div className="panel-head"><div><h2>Já enviadas</h2><p>Você pode rever suas entregas e o feedback recebido.</p></div></div>{done.length ? <div className="student-notebook-list">{done.map(card)}</div> : <EmptyState title="Nenhuma entrega ainda" description="Suas atividades enviadas aparecerão aqui." />}</section>
  </>;
}
