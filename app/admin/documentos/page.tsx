import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { archiveLegalDocument, createLegalRevision, publishLegalDocument, updateLegalDraft } from "@/app/admin/actions";
import { moveDocumentToTrash } from "./actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function decisionLabel(decision?: string | null) {
  if (decision === "accepted") return "Aceito";
  if (decision === "declined") return "Não autorizado";
  if (decision === "revoked") return "Revogado";
  return decision || "—";
}

export default async function AdminDocumentsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: legal }, { data: operational }, { data: acceptanceEvents }] = await Promise.all([
    supabase.from("legal_documents").select("id,title,public_slug,document_type,version,status,is_current,body,file_path,published_at,created_at").order("public_slug").order("version", { ascending: false }),
    supabase
      .from("documents")
      .select("id,title,document_type,file_path,student_id,guardian_id,subscription_id,visible_to_guardian,created_at,students(preferred_name,full_name),guardians(profiles(full_name,preferred_name))")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("legal_acceptance_events")
      .select("id,decision,document_slug,document_version,document_title,student_id,occurred_at,guardians(profiles(full_name,preferred_name)),students(preferred_name,full_name)")
      .order("occurred_at", { ascending: false })
      .limit(120),
  ]);

  const currentLegal = (legal ?? []).filter((doc: any) => doc.is_current);
  const publishedCount = currentLegal.filter((doc: any) => doc.status === "published").length;
  const draftCount = currentLegal.filter((doc: any) => doc.status === "draft").length;
  const placeholderCount = currentLegal.filter((doc: any) => String(doc.body || "").includes("PREENCHER")).length;
  const legalReady = currentLegal.length > 0 && publishedCount === currentLegal.length && placeholderCount === 0;
  const acceptedCount = (acceptanceEvents ?? []).filter((event: any) => event.decision === "accepted").length;
  const declinedCount = (acceptanceEvents ?? []).filter((event: any) => event.decision === "declined").length;
  const revokedCount = (acceptanceEvents ?? []).filter((event: any) => event.decision === "revoked").length;

  return (
    <>
      <PageHeader eyebrow="Admin • Operação" title="Documentos" description="Textos legais versionados, evidências de aceite e documentos operacionais. Apenas uma versão publicada e atual pode aparecer para o público." />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="panel">
        <div className="panel-head"><div><h2>Prontidão jurídica</h2><p>Visão rápida do que já está estruturado e do que ainda precisa ser fechado antes de considerar a camada jurídica pronta para uso público.</p></div><Badge tone={legalReady ? "green" : "yellow"}>{legalReady ? "Documentos publicados" : "Em preparação"}</Badge></div>
        <div className="student-home-stats student-home-stats-secondary">
          <article><strong>{currentLegal.length}</strong><small>Documentos atuais</small></article>
          <article><strong>{draftCount}</strong><small>Rascunhos</small></article>
          <article><strong>{publishedCount}</strong><small>Publicados</small></article>
          <article><strong>{placeholderCount}</strong><small>Com campos a preencher</small></article>
        </div>
        <div className="notice">
          <strong>Aceite versionado: implementado.</strong> O Ninho da Família registra a versão exata, o usuário autenticado e o horário do servidor para Termos, Privacidade e autorizações específicas. Antes de publicar os textos, ainda é necessário confirmar identificação da prestadora, regras comerciais reais, fornecedores que tratam dados e fazer a revisão jurídica/contábil final.
        </div>
      </section>

      <section className="panel legal-admin-panel">
        <div className="panel-head"><div><h2>Textos legais</h2><p>Documentos publicados não são sobrescritos: para alterar um texto já publicado, crie uma nova versão, revise e publique quando estiver pronta.</p></div></div>
        <div className="notice">Os documentos iniciais têm rascunhos editáveis. Eles não são publicados automaticamente: revise os campos marcados com “PREENCHER”, ajuste as regras comerciais e faça revisão jurídica/contábil antes de clicar em Publicar.</div>
        {legal?.length ? <div className="legal-doc-list">{legal.map((doc: any) => <article className="legal-doc-card" key={doc.id}>
          <div className="flex space-between gap-8 wrap"><div><div className="flex gap-8 wrap"><Badge tone={doc.status === "published" ? "green" : doc.status === "draft" ? "yellow" : "neutral"}>{doc.status === "published" ? "Publicado" : doc.status === "draft" ? "Rascunho" : "Arquivado"}</Badge><Badge tone="blue">v{doc.version}</Badge>{doc.is_current && <Badge tone="pink">atual</Badge>}{String(doc.body || "").includes("PREENCHER") && <Badge tone="yellow">requer preenchimento</Badge>}</div><h3>{doc.title}</h3><p>{doc.document_type}{doc.file_path ? " · tem arquivo" : doc.body ? " · texto no portal" : " · conteúdo ainda não vinculado"}</p></div><small className="muted">{doc.published_at ? `Publicado ${dt(doc.published_at)}` : `Criado ${dt(doc.created_at)}`}</small></div>
          {doc.status === "draft" ? <details className="plan-editor" open={!doc.body && !doc.file_path}><summary>Editar rascunho</summary><form action={updateLegalDraft} className="form-stack plan-form"><input type="hidden" name="documentId" value={doc.id} /><div className="form-row"><div className="field"><label>Título</label><input className="input" name="title" defaultValue={doc.title} required /></div><div className="field"><label>Tipo</label><input className="input" name="documentType" defaultValue={doc.document_type} required /></div></div><div className="field"><label>Texto do documento — rascunho editável</label><textarea className="textarea legal-textarea" name="body" defaultValue={doc.body || ""} placeholder="Edite o rascunho e revise antes de publicar." /></div><div className="field"><label>Caminho/URL do arquivo (opcional)</label><input className="input" name="filePath" defaultValue={doc.file_path || ""} placeholder="URL pública ou caminho de Storage" /></div><button className="button button-secondary" type="submit">Salvar rascunho</button></form></details> : null}
          <div className="flex gap-8 wrap legal-doc-actions">
            {doc.status === "published" && <form action={createLegalRevision}><input type="hidden" name="documentId" value={doc.id} /><button className="button button-secondary button-small" type="submit">Criar nova versão para editar</button></form>}
            {doc.status === "draft" && <form action={publishLegalDocument}><input type="hidden" name="documentId" value={doc.id} /><button className="button button-primary button-small" type="submit">Publicar esta versão</button></form>}
            {doc.status !== "archived" && <form action={archiveLegalDocument}><input type="hidden" name="documentId" value={doc.id} /><button className="button button-danger button-small" type="submit">Arquivar</button></form>}
          </div>
        </article>)}</div> : <EmptyState title="Nenhum texto legal" description="O catálogo jurídico aparecerá aqui." />}
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Evidências de aceite e autorização</h2><p>Histórico imutável das decisões registradas no Ninho da Família. A versão do documento permanece preservada mesmo quando uma nova versão for publicada.</p></div></div>
        <div className="student-home-stats student-home-stats-secondary">
          <article><strong>{acceptanceEvents?.length ?? 0}</strong><small>Eventos registrados</small></article>
          <article><strong>{acceptedCount}</strong><small>Aceites</small></article>
          <article><strong>{declinedCount}</strong><small>Não autorizações</small></article>
          <article><strong>{revokedCount}</strong><small>Revogações</small></article>
        </div>
        {acceptanceEvents?.length ? <div className="form-stack mt-16">{acceptanceEvents.map((event: any) => {
          const guardianProfile = Array.isArray(event.guardians?.profiles) ? event.guardians.profiles[0] : event.guardians?.profiles;
          const student = Array.isArray(event.students) ? event.students[0] : event.students;
          return <article className="mission-card" key={event.id}>
            <div className="flex space-between gap-8 wrap">
              <div>
                <div className="flex gap-8 wrap"><Badge tone={event.decision === "accepted" ? "green" : "pink"}>{decisionLabel(event.decision)}</Badge><Badge tone="blue">v{event.document_version}</Badge></div>
                <h3>{event.document_title}</h3>
                <p>{guardianProfile?.preferred_name || guardianProfile?.full_name || "Responsável"}{student ? ` · ${student.preferred_name || student.full_name}` : " · decisão da conta"}</p>
              </div>
              <small className="muted">{dt(event.occurred_at)}</small>
            </div>
          </article>;
        })}</div> : <EmptyState title="Nenhum aceite registrado ainda" description="Isso é esperado enquanto os documentos jurídicos permanecem em rascunho. Após a publicação, as decisões da Família aparecerão aqui." />}
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Documentos operacionais</h2><p>Contratos individuais, relatórios, anexos e outros arquivos vinculados a famílias ou alunos.</p></div></div>
        <div className="notice">Excluir um documento operacional não apaga o arquivo nem rompe o vínculo com aluno, responsável ou assinatura. Ele vai para a Lixeira com o mesmo ID e pode ser restaurado.</div>
        {operational?.length ? <div className="form-stack">{operational.map((doc: any) => <article className="mission-card" key={doc.id}>
          <div className="flex space-between gap-8 wrap">
            <div>
              <strong>{doc.title}</strong>
              <p>{doc.document_type} · {doc.students?.preferred_name || doc.students?.full_name || doc.guardians?.profiles?.preferred_name || doc.guardians?.profiles?.full_name || "Documento geral"}</p>
            </div>
            <Badge tone={doc.visible_to_guardian ? "green" : "neutral"}>{doc.visible_to_guardian ? "Visível à família" : "Interno"}</Badge>
          </div>
          <small className="muted">{dt(doc.created_at)}</small>
          {doc.file_path && <div className="asset-path">{doc.file_path}</div>}
          <details className="plan-editor mt-12">
            <summary className="button button-danger button-small">Excluir</summary>
            <form action={moveDocumentToTrash} className="form-stack compact-form">
              <input type="hidden" name="documentId" value={doc.id} />
              <div className="field"><label>Motivo opcional</label><input className="input" name="reason" placeholder="Ex.: documento duplicado" /></div>
              <button className="button button-danger button-small" type="submit">Enviar para a Lixeira</button>
            </form>
          </details>
        </article>)}</div> : <EmptyState title="Nenhum documento operacional" description="Contratos e arquivos vinculados aparecerão aqui." />}
      </section>
    </>
  );
}
