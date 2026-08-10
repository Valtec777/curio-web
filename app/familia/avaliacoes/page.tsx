import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { reportFamilyAssessment } from "@/app/familia/actions";
import { getFamilyPortal } from "@/lib/family";

function date(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`));
}

export default async function FamilyAssessmentsPage({ searchParams }: { searchParams: Promise<{ aluno?: string; erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { children, selectedChild, supabase } = await getFamilyPortal(query.aluno || null);
  if (!selectedChild) return <EmptyState title="Nenhuma criança vinculada" description="As avaliações aparecerão depois que houver uma criança vinculada." />;

  const [{ data: subjects }, { data: assigned }, { data: reported }] = await Promise.all([
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("assessment_students").select("id,status,score,submitted_at,reviewed_at,assessments(title,scheduled_for,instructions,file_path,subjects(name))").eq("student_id", selectedChild.student_id).order("created_at", { ascending: false }).limit(60),
    supabase.from("family_assessment_reports").select("id,origin,title,assessment_date,content,observations,file_path,file_name,status,created_at,subjects(name)").eq("student_id", selectedChild.student_id).order("assessment_date", { ascending: false }).limit(60),
  ]);
  const assignedRows = (assigned ?? []) as any[];
  const reportedRows = (reported ?? []) as any[];

  const assignedFiles = new Map<string, string>();
  for (const item of assignedRows) {
    const path = item.assessments?.file_path;
    if (!path) continue;
    const { data } = await supabase.storage.from("teacher-materials").createSignedUrl(path, 60 * 20);
    if (data?.signedUrl) assignedFiles.set(item.id, data.signedUrl);
  }
  const reportedFiles = new Map<string, string>();
  for (const item of reportedRows) {
    if (!item.file_path) continue;
    const { data } = await supabase.storage.from("family-uploads").createSignedUrl(item.file_path, 60 * 20);
    if (data?.signedUrl) reportedFiles.set(item.id, data.signedUrl);
  }

  return <><PageHeader eyebrow="Ninho da Família" title={`Avaliações · ${selectedChild.student_name}`} description="Acompanhe avaliações do CURIÓ e informe provas ou avaliações recebidas da escola." />{query.erro && <div className="form-message form-error">{query.erro}</div>}{query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}<section className="panel family-highlight"><div className="panel-head"><div><h2>Informar avaliação</h2><p>Registre uma prova ou avaliação recebida pela família ou diretamente pela escola.</p></div></div><form action={reportFamilyAssessment} className="form-stack"><div className="form-row"><div className="field"><label>Criança</label><select className="select" name="studentId" defaultValue={selectedChild.student_id}>{children.map((child) => <option value={child.student_id} key={child.student_id}>{child.student_name}</option>)}</select></div><div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue=""><option value="">Não definida</option>{(subjects ?? []).map((subject: any) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></div></div><div className="form-row"><div className="field"><label>Origem</label><select className="select" name="origin" defaultValue="school"><option value="school">Escola</option><option value="guardian">Responsável</option></select></div><div className="field"><label>Data *</label><input className="input" type="date" name="assessmentDate" required /></div></div><div className="field"><label>Título *</label><input className="input" name="title" required placeholder="Ex.: Prova de Ciências — Unidade 3" /></div><div className="field"><label>Conteúdo</label><textarea className="textarea textarea-compact" name="content" /></div><div className="field"><label>Observações</label><textarea className="textarea textarea-compact" name="observations" /></div><div className="field"><label>Foto/PDF — opcional</label><input className="input" type="file" name="assessmentFile" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" /></div><button className="button button-primary" type="submit">Salvar avaliação</button></form></section><div className="grid-2"><section className="panel"><div className="panel-head"><div><h2>Avaliações do CURIÓ</h2><p>Publicadas pela professora para acompanhamento.</p></div></div>{assignedRows.length ? <div className="form-stack">{assignedRows.map((item: any) => <article className="family-upload-card" key={item.id}><div className="flex space-between gap-8 wrap"><div><Badge tone="blue">{item.assessments?.subjects?.name || "Avaliação"}</Badge><h3>{item.assessments?.title || "Avaliação"}</h3><p>{item.assessments?.instructions || "Sem observações adicionais."}</p></div>{item.score != null ? <Badge tone="green">Nota {item.score}</Badge> : <Badge tone="yellow">{item.status === "assigned" ? "Agendada" : item.status}</Badge>}</div><small className="muted">Data: {date(item.assessments?.scheduled_for)}</small>{assignedFiles.get(item.id) ? <div className="mt-12"><a className="button button-secondary button-small" href={assignedFiles.get(item.id)} target="_blank" rel="noreferrer">Abrir arquivo ↗</a></div> : null}</article>)}</div> : <EmptyState title="Sem avaliações do CURIÓ" description="Quando a professora publicar uma avaliação, ela aparecerá aqui." />}</section><section className="panel"><div className="panel-head"><div><h2>Informadas pela família/escola</h2><p>Histórico do que foi enviado para a equipe.</p></div></div>{reportedRows.length ? <div className="form-stack">{reportedRows.map((item: any) => <article className="family-upload-card" key={item.id}><div className="flex space-between gap-8 wrap"><div><Badge tone="purple">{item.origin === "school" ? "Escola" : "Responsável"}</Badge><h3>{item.title}</h3><p>{item.subjects?.name || "Sem matéria"} · {date(item.assessment_date)}</p></div><Badge tone={item.status === "linked" ? "green" : "neutral"}>{item.status === "linked" ? "Usada no acompanhamento" : "Informada"}</Badge></div>{item.content ? <p><strong>Conteúdo:</strong> {item.content}</p> : null}{item.observations ? <p>{item.observations}</p> : null}{reportedFiles.get(item.id) ? <a className="button button-secondary button-small" href={reportedFiles.get(item.id)} target="_blank" rel="noreferrer">Abrir anexo ↗</a> : null}</article>)}</div> : <EmptyState title="Sem avaliações informadas" description="Use o formulário acima quando receber uma prova ou avaliação da escola." />}</section></div></>;
}
