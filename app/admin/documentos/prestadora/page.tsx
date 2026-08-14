import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { defaultLegalProviderProfile, providerProfileMissingFields } from "@/lib/legal-templates";
import { updateLegalProviderProfile } from "../actions";

export default async function LegalProviderSettingsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "legal_provider_profile").maybeSingle();
  const provider: any = { ...defaultLegalProviderProfile, ...(data?.value && typeof data.value === "object" ? data.value : {}) };
  const missing = providerProfileMissingFields(provider);
  return <>
    <PageHeader eyebrow="Admin • Documentos" title="Identificação jurídica da prestadora" description="Preencha uma única vez. Estes dados são reutilizados automaticamente nos documentos, contratos e recibos." action={<Link className="button button-secondary" href="/admin/documentos">Voltar aos documentos</Link>} />
    {query.erro && <div className="form-message form-error">{query.erro}</div>}{query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
    <section className="panel family-highlight"><div className="panel-head"><div><h2>Prontidão</h2><p>Enquanto você atua como pessoa física, informe seu nome civil e CPF. Se depois houver CNPJ, os novos documentos podem usar os dados empresariais sem alterar contratos antigos já assinados.</p></div><Badge tone={missing.length ? "yellow" : "green"}>{missing.length ? `${missing.length} pendência(s)` : "Completo"}</Badge></div><div className="notice">A identificação da prestadora pode aparecer em documentos públicos. Use um endereço adequado para comunicações e confirme a solução com advogado/contador antes da publicação definitiva.</div></section>
    <section className="panel"><form action={updateLegalProviderProfile} className="form-stack">
      <div className="form-row"><div className="field"><label>Nome comercial</label><input className="input" name="brandName" defaultValue={provider.brandName} required /></div><div className="field"><label>Nome civil / razão social</label><input className="input" name="legalName" defaultValue={provider.legalName} required /></div></div>
      <div className="form-row"><div className="field"><label>CPF / CNPJ</label><input className="input" name="taxId" defaultValue={provider.taxId} required /></div><div className="field"><label>Telefone / WhatsApp</label><input className="input" name="phone" defaultValue={provider.phone} required /></div></div>
      <div className="field"><label>Endereço para identificação e comunicações</label><input className="input" name="address" defaultValue={provider.address} required /></div>
      <div className="form-row"><div className="field"><label>E-mail de atendimento</label><input className="input" type="email" name="email" defaultValue={provider.email} required /></div><div className="field"><label>Canal de privacidade / LGPD</label><input className="input" type="email" name="privacyContact" defaultValue={provider.privacyContact} required /></div></div>
      <button className="button button-primary" type="submit">Salvar identificação da prestadora</button>
    </form></section>
  </>;
}
