import Link from "next/link";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";

function dateLabel(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Bahia" }).format(new Date(value));
}

export default async function ValidateCertificatePage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const query = await searchParams;
  const code = String(query.codigo || "").trim().toUpperCase().slice(0, 40);
  const supabase = await createClient();
  let verification: any = null;
  let lookupError = false;

  if (code) {
    const { data, error } = await supabase.rpc("verify_free_course_certificate", { p_code: code });
    lookupError = Boolean(error);
    verification = Array.isArray(data) ? data[0] : data;
  }

  return (
    <main className="legal-public-page">
      <header className="legal-public-header">
        <div className="site-shell flex space-between align-center wrap">
          <Logo />
          <Link className="button button-secondary button-small" href="/">Voltar ao site</Link>
        </div>
      </header>

      <section className="site-shell legal-document-sheet">
        <div className="eyebrow">Cursos Livres</div>
        <h1>Validar certificado</h1>
        <p className="muted">Digite exatamente o código exibido no certificado. A consulta confirma a emissão sem expor IDs internos ou o nome civil completo do estudante.</p>

        <form className="form-stack mt-16" method="get">
          <div className="field">
            <label htmlFor="codigo">Código de validação</label>
            <input
              className="input"
              id="codigo"
              name="codigo"
              defaultValue={code}
              placeholder="CURIO-XXXXXXXXXXXX"
              autoComplete="off"
              maxLength={40}
              required
            />
          </div>
          <button className="button button-primary" type="submit">Verificar certificado</button>
        </form>

        {code && lookupError ? (
          <div className="form-message form-error mt-16">Não foi possível consultar agora. Tente novamente em alguns instantes.</div>
        ) : null}

        {code && !lookupError && verification?.valid ? (
          <article className="panel mt-16">
            <div className="flex space-between gap-8 wrap">
              <div>
                <div className="eyebrow">Certificado válido</div>
                <h2>{verification.course_title}</h2>
              </div>
              <span className="badge badge-green">Válido</span>
            </div>
            <div className="profile-lines mt-16">
              <div><span>Estudante</span><strong>{verification.holder_name}</strong></div>
              <div><span>Emissão</span><strong>{dateLabel(verification.issued_at)}</strong></div>
              <div><span>Carga horária pedagógica estimada</span><strong>{verification.estimated_minutes} minutos</strong></div>
              <div><span>Código</span><strong>{verification.certificate_code}</strong></div>
            </div>
            <p className="muted mt-16">Este registro confirma um certificado de curso livre emitido pela plataforma. Ele não equivale, por si só, a diploma escolar, técnico ou certificação profissional regulamentada.</p>
          </article>
        ) : null}

        {code && !lookupError && verification && !verification.valid ? (
          <div className="form-message form-error mt-16">Nenhum certificado válido foi encontrado para esse código. Confira os caracteres e tente novamente.</div>
        ) : null}
      </section>
    </main>
  );
}
