import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <main className="legal-public-page">
      <header className="legal-public-header">
        <div className="site-shell flex space-between align-center wrap">
          <Logo />
          <Link className="button button-secondary button-small" href="/">← Voltar ao site</Link>
        </div>
      </header>
      <article className="site-shell legal-document-sheet">
        <div className="eyebrow">{document.document_type} · versão {document.version}</div>
        <h1>{document.title}</h1>
        {document.published_at && <small className="muted">Versão publicada pelo Curió.</small>}
        {document.body && <div className="legal-document-body">{document.body}</div>}
        {document.file_path && <p><a className="button button-primary" href={document.file_path} target="_blank" rel="noreferrer">Abrir documento completo ↗</a></p>}
        <footer className="legal-document-contact">Dúvidas: <a href="mailto:curio.educacao@gmail.com">curio.educacao@gmail.com</a></footer>
      </article>
    </main>
  );
}
