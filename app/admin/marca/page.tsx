import { AdminBrandLogoRestore } from "@/components/admin-brand-logo-restore";
import { AdminBrandLogoUpload } from "@/components/admin-brand-logo-upload";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { BRAND_SETTING_KEY, BRAND_SYMBOL_FALLBACK } from "@/lib/brand-assets";
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
        title="Marca e logos"
        description="A Plumareli usa uma assinatura principal nos espaços amplos e um símbolo reduzido nos ambientes compactos."
      />

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Logo principal</h2>
              <p>Assinatura completa para cabeçalho público, autenticação, rodapé e outros espaços onde o nome pode ser lido com conforto.</p>
            </div>
          </div>
          <div className="form-stack">
            <div className="brand-admin-preview" style={{ minHeight: 240, display: "grid", placeItems: "center", padding: 28, border: "1px solid var(--border)", borderRadius: 24 }}>
              <img
                src={`/api/brand/logo?v=${previewVersion}`}
                alt="Logo principal atual do Plumareli"
                style={{ display: "block", width: "min(100%, 420px)", maxHeight: 210, objectFit: "contain" }}
              />
            </div>
            <div className="notice text-small">
              <strong>Uso estratégico:</strong> aparece em áreas horizontais e com respiro. Não é mais repetida dentro das sidebars compactas.
            </div>
            {hasCustomLogo ? <AdminBrandLogoRestore /> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Logo reduzida</h2>
              <p>O símbolo com o P e a personagem identifica a Plumareli quando a assinatura completa ficaria pequena ou espremida.</p>
            </div>
          </div>
          <div className="form-stack">
            <div className="brand-admin-preview" style={{ minHeight: 240, display: "grid", placeItems: "center", padding: 28, border: "1px solid var(--border)", borderRadius: 24 }}>
              <img
                src={BRAND_SYMBOL_FALLBACK}
                alt="Logo reduzida do Plumareli"
                style={{ display: "block", width: 132, height: 132, objectFit: "contain" }}
              />
            </div>
            <div className="notice text-small">
              <strong>Uso estratégico:</strong> menus internos do Admin, Professor, Família e Aluno. O tamanho é mantido legível e sem competir com o conteúdo da tela.
            </div>
          </div>
        </section>
      </div>

      <section className="panel mt-16">
        <AdminBrandLogoUpload />
      </section>

      <section className="panel mt-16">
        <div className="panel-head">
          <div>
            <h2>Regra da marca no produto</h2>
            <p>As duas versões trabalham juntas: a principal apresenta a marca; a reduzida assina a navegação recorrente.</p>
          </div>
        </div>
        <div className="notice text-small">
          Trocar a logo principal pelo Admin não substitui o símbolo reduzido. A logo original do repositório também nunca é apagada e continua disponível como fallback.
        </div>
      </section>
    </>
  );
}
