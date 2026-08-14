import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { PrivateFamilyUploadForm } from "@/components/private-family-upload-form";
import { getFamilyPortal } from "@/lib/family";
import { registerFamilySchoolContent } from "../upload-actions";

function dateLabel(value?: string | null) {
  if (!value) return "Sem data relacionada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function typeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    school_material: "Material escolar", notebook_photo: "Foto do caderno", school_notice: "Aviso da escola",
    assignment: "Atividade", assessment_notice: "Aviso de prova", other: "Outro",
  };
  return labels[value || ""] || "Conteúdo";
}

export default async function FamilySchoolContentPage({ searchParams }: { searchParams: Promise<{ aluno?: string; erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { children, selectedChild, supabase } = await getFamilyPortal(query.aluno || null);
  if (!selectedChild) return <EmptyState title="Nenhuma criança vinculada" description="Conclua o vínculo antes de enviar conteúdo da escola." />;

  const [{ data: subjects }, { data: uploads }] = await Promise.all([
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("family_school_uploads").select("id,title,content_type,description,related_date,file_path,file_name,status,created_at,subjects(name)").eq("student_id", selectedChild.student_id).order("created_at", { ascending: false }).limit(50),
  ]);

  const signed = new Map<string, string>();
  for (const item of uploads ?? []) {
    const { data } = await supabase.storage.from("family-uploads").createSignedUrl(item.file_path, 60 * 20);
    if (data?.signedUrl) signed.set(item.id, data.signedUrl);
  }

  return (
    <>
      <PageHeader
        eyebrow="Ninho da Família"
        title={`Conteúdo da Escola · ${selectedChild.student_name}`}
        description="Envie fotos do caderno, PDFs, atividades, avisos e conteúdos recebidos da escola."
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="grid-2">
        <section className="panel family-highlight">
          <div className="panel-head"><div><h2>Enviar conteúdo</h2><p>O professor poderá usar este material no acompanhamento da criança.</p></div></div>
          <PrivateFamilyUploadForm action={registerFamilySchoolContent} studentId={selectedChild.student_id} kind="school" fileField="schoolFile">
            <div className="field"><label>Criança</label><select className="select" name="studentId" defaultValue={selectedChild.student_id}>{children.map((child) => <option value={child.student_id} key={child.student_id}>{child.student_name}</option>)}</select></div>
            <div className="field"><label>Título *</label><input className="input" name="title" required placeholder="Ex.: Conteúdo de Ciências desta semana" /></div>
            <div className="form-row">
              <div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue=""><option value="">Não definida</option>{(subjects ?? []).map((subject: any) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></div>
              <div className="field"><label>Tipo</label><select className="select" name="contentType" defaultValue="school_material"><option value="school_material">Material escolar</option><option value="notebook_photo">Foto do caderno</option><option value="school_notice">Aviso da escola</option><option value="assignment">Atividade</option><option value="assessment_notice">Aviso de prova</option><option value="other">Outro</option></select></div>
            </div>
            <div className="field"><label>Descrição</label><textarea className="textarea" name="description" placeholder="Explique rapidamente o que a escola enviou ou pediu." /></div>
            <div className="field"><label>Data relacionada da prova/atividade</label><input className="input" type="date" name="relatedDate" /></div>
            <div className="field"><label>Arquivo *</label><input className="input" type="file" name="schoolFile" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" required /><small className="muted">PDF ou imagem · até 15 MB. O arquivo vai direto para o armazenamento privado.</small></div>
            <button className="button button-primary" type="submit">Enviar conteúdo</button>
          </PrivateFamilyUploadForm>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2>Enviados recentemente</h2><p>Histórico de {selectedChild.student_name}.</p></div></div>
          {uploads?.length ? (
            <div className="family-upload-history">
              {uploads.map((item: any) => (
                <article className="family-upload-row" key={item.id}>
                  <div>
                    <div className="flex gap-8 wrap"><Badge tone="blue">{typeLabel(item.content_type)}</Badge><Badge tone={item.status === "linked" ? "green" : "neutral"}>{item.status === "linked" ? "Usado no acompanhamento" : "Recebido"}</Badge></div>
                    <strong>{item.title}</strong>
                    <small>{item.subjects?.name || "Sem matéria"} · {dateLabel(item.related_date)} · {item.file_name}</small>
                  </div>
                  {signed.get(item.id) ? <a className="button button-secondary button-small" href={signed.get(item.id)} target="_blank" rel="noreferrer">Abrir ↗</a> : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <img src="/mascotes/curio_capivara_principal_acolhendo.png" alt="Capivara Curió" style={{ maxHeight: 150, objectFit: "contain" }} />
              <EmptyState title="Nada enviado ainda" description="Envie fotos do caderno, PDF ou aviso da escola pelo formulário ao lado." />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
