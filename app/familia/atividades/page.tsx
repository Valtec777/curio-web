import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { submitFamilyNotebookActivity } from "@/app/familia/actions";
import { getFamilyPortal } from "@/lib/family";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function deliveryLabel(submittedAt?: string | null, dueAt?: string | null) {
  if (!submittedAt) return dueAt && new Date(dueAt) < new Date() ? "Prazo vencido" : "Pendente";
  if (!dueAt) return `Enviada em ${dt(submittedAt)}`;
  return new Date(submittedAt) <= new Date(dueAt) ? `Enviada no prazo · ${dt(submittedAt)}` : `Enviada com atraso · ${dt(submittedAt)}`;
}

export default async function FamilyActivitiesPage({ searchParams }: { searchParams: Promise<{ aluno?: string; erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { selectedChild, supabase } = await getFamilyPortal(query.aluno || null);
  if (!selectedChild) return <EmptyState title="Nenhuma criança vinculada" description="As atividades aparecerão quando houver uma criança vinculada à família." />;

  const [{ data: notebooks }, { data: missions }] = await Promise.all([
    supabase.from("notebook_assignments").select("id,status,due_at,submitted_at,submission_photo_path,teacher_note,guardian_note,score,needs_redo,redo_note,notebook_activities(id,title,description,worksheet_path,publish_at,subjects(name))").eq("student_id", selectedChild.student_id).order("created_at", { ascending: false }).limit(80),
    supabase.from("mission_students").select("id,status,due_at,completed_at,progress_percent,after_score,missions(title,objective)").eq("student_id", selectedChild.student_id).order("assigned_at", { ascending: false }).limit(50),
  ]);
  const notebookRows = (notebooks ?? []) as any[];
  const missionRows = (missions ?? []) as any[];

  const worksheetUrls = new Map<string, string>();
  for (const item of notebookRows) {
    const path = item.notebook_activities?.worksheet_path;
    if (!path) continue;
    const { data } = await supabase.storage.from("teacher-materials").createSignedUrl(path, 60 * 20);
    if (data?.signedUrl) worksheetUrls.set(item.id, data.signedUrl);
  }
  const submittedUrls = new Map<string, string>();
  for (const item of notebookRows) {
    if (!item.submission_photo_path) continue;
    const { data } = await supabase.storage.from("family-uploads").createSignedUrl(item.submission_photo_path, 60 * 20);
    if (data?.signedUrl) submittedUrls.set(item.id, data.signedUrl);
  }

  const pending = notebookRows.filter((item: any) => ["assigned", "in_progress"].includes(item.status) && !item.needs_redo);
  const sent = notebookRows.filter((item: any) => ["submitted", "reviewed"].includes(item.status) && !item.needs_redo);
  const redo = notebookRows.filter((item: any) => item.needs_redo);
  const assignmentCard = (item: any, canSubmit: boolean, redoMode = false) => (
    <article className="family-upload-card" key={item.id}>
      <div className="flex space-between gap-8 wrap"><div><div className="flex gap-8 wrap"><Badge tone={redoMode ? "pink" : item.status === "reviewed" ? "green" : item.status === "submitted" ? "blue" : "yellow"}>{redoMode ? "Para refazer" : item.status === "reviewed" ? "Corrigida" : item.status === "submitted" ? "Enviada" : "Pendente"}</Badge>{item.notebook_activities?.subjects?.name ? <Badge tone="purple">{item.notebook_activities.subjects.name}</Badge> : null}</div><h3>{item.notebook_activities?.title || "Atividade do Caderno Curió"}</h3><p>{item.notebook_activities?.description || "Atividade preparada para treino fora da tela."}</p></div>{worksheetUrls.get(item.id) ? <a className="button button-secondary button-small" href={worksheetUrls.get(item.id)} target="_blank" rel="noreferrer">Abrir atividade ↗</a> : null}</div>
      <div className="teacher-resource-meta"><span>Prazo: {dt(item.due_at)}</span><span>• {deliveryLabel(item.submitted_at, item.due_at)}</span>{item.score != null ? <span>• Nota: {item.score}</span> : null}</div>
      {redoMode && item.redo_note ? <div className="form-message form-error"><strong>Orientação para refazer</strong><div>{item.redo_note}</div></div> : null}
      {item.teacher_note && !redoMode ? <div className="form-message form-success"><strong>Feedback do professor</strong><div>{item.teacher_note}</div></div> : null}
      {submittedUrls.get(item.id) ? <a href={submittedUrls.get(item.id)} target="_blank" rel="noreferrer">Ver arquivo enviado ↗</a> : null}
      {canSubmit ? <form action={submitFamilyNotebookActivity} className="form-stack mt-12"><input type="hidden" name="assignmentId" value={item.id} /><input type="hidden" name="studentId" value={selectedChild.student_id} /><div className="field"><label>{redoMode ? "Enviar atividade refeita *" : "Enviar atividade *"}</label><input className="input" type="file" name="activityFile" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" required /><small className="muted">PDF ou imagem · até 15 MB.</small></div><div className="field"><label>Observação para o professor — opcional</label><textarea className="textarea textarea-compact" name="note" defaultValue={item.guardian_note || ""} /></div><button className="button button-primary" type="submit">{redoMode ? "Enviar novamente" : "Enviar atividade"}</button></form> : null}
    </article>
  );

  return <><PageHeader eyebrow="Ninho da Família" title={`Atividades de ${selectedChild.student_name}`} description="Acompanhe o que está pendente, o que já foi enviado e o que precisa ser feito novamente." />{query.erro && <div className="form-message form-error">{query.erro}</div>}{query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}<div className="family-metric-grid mb-20"><div className="family-metric"><strong>{pending.length}</strong><span>Pendentes</span></div><div className="family-metric"><strong>{sent.length}</strong><span>Enviadas / corrigidas</span></div><div className="family-metric"><strong>{redo.length}</strong><span>Para refazer</span></div><div className="family-metric"><strong>{missionRows.filter((item: any) => ["completed", "reviewed"].includes(String(item.status))).length}</strong><span>Missões concluídas</span></div></div>{redo.length ? <section className="panel"><div className="panel-head"><div><h2>Para refazer</h2><p>O professor indicou o que precisa ser retomado antes de reenviar.</p></div></div><div className="form-stack">{redo.map((item: any) => assignmentCard(item, true, true))}</div></section> : null}<section className="panel"><div className="panel-head"><div><h2>Pendentes</h2><p>Abra o arquivo completo, faça a atividade e envie a foto ou PDF.</p></div></div>{pending.length ? <div className="form-stack">{pending.map((item: any) => assignmentCard(item, true))}</div> : <EmptyState title="Nenhuma atividade pendente" description="As novas atividades do Caderno Curió aparecerão aqui." />}</section><section className="panel"><div className="panel-head"><div><h2>Enviadas</h2><p>Entregas aguardando correção ou já devolvidas pelo professor.</p></div></div>{sent.length ? <div className="form-stack">{sent.map((item: any) => assignmentCard(item, false))}</div> : <EmptyState title="Nenhuma atividade enviada ainda" description="Quando uma atividade for entregue, ela aparecerá aqui." />}</section><section className="panel"><div className="panel-head"><div><h2>Missões Cuca</h2><p>As missões interativas têm correção objetiva automática quando há gabarito.</p></div></div>{missionRows.length ? <div className="family-upload-history">{missionRows.map((item: any) => <article className="family-upload-row" key={item.id}><div><strong>{item.missions?.title || "Missão Cuca"}</strong><small>{item.progress_percent}% concluído · prazo {dt(item.due_at)}</small></div><Badge tone={["completed", "reviewed"].includes(String(item.status)) ? "green" : "yellow"}>{["completed", "reviewed"].includes(String(item.status)) ? (item.after_score != null ? `Concluída · ${item.after_score}%` : "Concluída") : "Em andamento"}</Badge></article>)}</div> : <EmptyState title="Nenhuma missão atribuída" description="As Missões Cuca aparecerão aqui quando forem publicadas para a criança." />}</section></>;
}
