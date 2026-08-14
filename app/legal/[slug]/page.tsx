import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { getLegalProviderProfile, providerTemplateVariables, renderLegalTemplate } from "@/lib/legal-templates";

export default async function PublicLegalDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("legal_documents")
    .select("title,document_type,version,body,file_path,published_at")
    .eq("public_slug", slug)
    .eq("status", "published")
    .eq("is_current", true)
    .maybeSingle();
  if (!document || (!document.body && !document.file_path)) notFound();

  const provider = await getLegalProviderProfile(supabase);
  const body = document.body ? renderLegalTemplate(document.body, providerTemplateVariables(provider)) : "";
  return (
    <main className="legal-public-page">
      <header className="legal-public-header"><div className="site-shell flex space-between align-center wrap"><Logo /><Link className="button button-secondary button-small" href="/">← Voltar ao site</Link></div></header>
      <article className="site-shell legal-document-sheet">
        <div className="eyebrow">{document.document_type} · versão {document.version}</div>
        <h1>{document.title}</h1>
        {document.published_at && <small className="muted">Versão vigente publicada pela Administração.</small>}
        {body && <div className="legal-document-body">{body}</div>}
        {document.file_path && <p><a className="button button-primary" href={document.file_path} target="_blank" rel="noreferrer">Abrir documento completo ↗</a></p>}
        <footer className="legal-document-contact">Dúvidas: <a href={`mailto:${provider.email}`}>{provider.email}</a>{provider.privacyContact && provider.privacyContact !== provider.email ? <> · Privacidade: <a href={`mailto:${provider.privacyContact}`}>{provider.privacyContact}</a></> : null}</footer>
      </article>
    </main>
  );
}
