import { AdminBrandLogoRestore } from "@/components/admin-brand-logo-restore";
import { AdminBrandLogoUpload } from "@/components/admin-brand-logo-upload";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { BRAND_SETTING_KEY } from "@/lib/brand-assets";
import { createClient } from "@/lib/supabase/server";

export default async function AdminBrandPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value,updated_at")
    .eq("key", BRAND_SETTING_KEY)
    .maybeSingle();

  const value = (setting?.value || {}) as Record<string, unknown>;
  const hasCustomLogo = typeof value.logo === "string" && value.logo.trim().length > 0;
  const previewVersion = encodeURIComponent(setting?.updated_at || "original");

  return (
    <>
      <PageHeader
        eyebrow="Sistema"
        title="Marca e logo"
        description="Troque a logo do Plumareli sem editar código. A imagem ativa passa a ser usada pelos componentes centrais da marca."
      />

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Logo atual</h2>
              <p>{hasCustomLogo ? "Você está usando uma logo enviada pelo Admin." : "Você está usando a logo original versionada no projeto."}</p>
            </div>
          </div>
          <div className="form-stack">
            <div className="brand-admin-preview" style={{ minHeight: 180, display: "grid", placeItems: "center", padding: 24, border: "1px solid var(--border)", borderRadius: 18 }}>
              <img
                src={`/api/brand/logo?v=${previewVersion}`}
                alt="Logo atual do Plumareli"
                style={{ display: "block", maxWidth: "100%", maxHeight: 150, objectFit: "contain" }}
              />
            </div>
            <p className="muted text-small mb-0">Esta prévia usa a mesma fonte central consumida pelo restante do site.</p>
            {hasCustomLogo ? <AdminBrandLogoRestore /> : null}
          </div>
        </section>

        <section className="panel">
          <AdminBrandLogoUpload />
        </section>
      </div>

      <section className="panel mt-16">
        <div className="panel-head">
          <div>
            <h2>Como funciona</h2>
            <p>O arquivo enviado recebe uma URL nova e vira a logo ativa. A versão anterior deixa de ser usada, evitando que o navegador mostre uma imagem antiga por cache.</p>
          </div>
        </div>
        <div className="notice text-small">
          A logo original do repositório nunca é apagada: ela continua disponível como fallback e pode ser restaurada pelo Admin.
        </div>
      </section>
    </>
  );
}
