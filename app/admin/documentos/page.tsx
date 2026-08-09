import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { archiveLegalDocument, createLegalRevision, publishLegalDocument, updateLegalDraft } from "@/app/admin/actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

export default async function AdminDocumentsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: legal }, { data: operational }] = await Promise.all([
    supabase.from("legal_documents").select("id,title,public_slug,document_type,version,status,is_current,body,file_path,published_at,created_at").order("public_slug").order("version", { ascending: false }),
    supabase.from("documents").select("id,title,document_type,file_path,student_id,guardian_id,visible_to_guardian,created_at").order("created_at", { ascending: false }).limit(80),
  ]);

  return (
    <>
      <PageHeader eyebrow="Admin • Operação" title="Documentos" description="Textos legais versionados e documentos operacionais. Apenas uma versão publicada e atual pode aparecer para o público." />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="panel legal-admin-panel">
        <div className="panel-head"><div><h2>Textos legais</h2><p>Documentos publicados não são sobrescritos: para alterar um texto já publicado, crie uma nova versão, revise e publique quando estiver pronta.</p></div></div>
        <div className="notice">Os títulos que você informou foram cadastrados como metadados. Para os arquivos que estavam fora deste projeto, cole o caminho/URL real ou o conteúdo antes de republicar. O Curió não inventa texto jurídico.</div>
        {legal?.length ? <div className="legal-doc-list">{legal.map((doc: any) => <article className="legal-doc-card" key={doc.id}>
          <div className="flex space-between gap-8 wrap"><div><div className="flex gap-8 wrap"><Badge tone={doc.status === "published" ? "green" : doc.status === "draft" ? "yellow" : "neutral"}>{doc.status === "published" ? "Publicado" : doc.status === "draft" ? "Rascunho" : "Arquivado"}</Badge><Badge tone="blue">v{doc.version}</Badge>{doc.is_current && <Badge tone="pink">atual</Badge>}</div><h3>{doc.title}</h3><p>{doc.document_type}{doc.file_path ? " · tem arquivo" : doc.body ? " · texto no portal" : " · conteúdo ainda não vinculado"}</p></div><small className="muted">{doc.published_at ? `Publicado ${dt(doc.published_at)}` : `Criado ${dt(doc.created_at)}`}</small></div>
          {doc.status === "draft" ? <details className="plan-editor" open={!doc.body && !doc.file_path}><summary>Editar rascunho</summary><form action={updateLegalDraft} className="form-stack plan-form"><input type="hidden" name="documentId" value={doc.id} /><div className="form-row"><div className="field"><label>Título</label><input className="input" name="title" defaultValue={doc.title} required /></div><div className="field"><label>Tipo</label><input className="input" name="documentType" defaultValue={doc.document_type} required /></div></div><div className="field"><label>Texto do documento</label><textarea className="textarea legal-textarea" name="body" defaultValue={doc.body || ""} placeholder="Cole aqui o texto jurídico já revisado." /></div><div className="field"><label>Caminho/URL do arquivo (opcional)</label><input className="input" name="filePath" defaultValue={doc.file_path || ""} placeholder="URL pública ou caminho de Storage" /></div><button className="button button-secondary" type="submit">Salvar rascunho</button></form></details> : null}
          <div className="flex gap-8 wrap legal-doc-actions">
            {doc.status === "published" && <form action={createLegalRevision}><input type="hidden" name="documentId" value={doc.id} /><button className="button button-secondary button-small" type="submit">Criar nova versão para editar</button></form>}
            {doc.status === "draft" && <form action={publishLegalDocument}><input type="hidden" name="documentId" value={doc.id} /><button className="button button-primary button-small" type="submit">Publicar esta versão</button></form>}
            {doc.status !== "archived" && <form action={archiveLegalDocument}><input type="hidden" name="documentId" value={doc.id} /><button className="button button-danger button-small" type="submit">Arquivar</button></form>}
          </div>
        </article>)}</div> : <EmptyState title="Nenhum texto legal" description="O catálogo jurídico aparecerá aqui." />}
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Documentos operacionais</h2><p>Contratos individuais, relatórios, anexos e outros arquivos vinculados a famílias ou alunos.</p></div></div>
        {operational?.length ? <div className="form-stack">{operational.map((doc: any) => <article className="mission-card" key={doc.id}><div className="flex space-between gap-8 wrap"><div><strong>{doc.title}</strong><p>{doc.document_type}</p></div><Badge tone={doc.visible_to_guardian ? "green" : "neutral"}>{doc.visible_to_guardian ? "Visível à família" : "Interno"}</Badge></div><small className="muted">{dt(doc.created_at)}</small>{doc.file_path && <div className="asset-path">{doc.file_path}</div>}</article>)}</div> : <EmptyState title="Nenhum documento operacional" description="Contratos e arquivos vinculados aparecerão aqui." />}
      </section>
    </>
  );
}
