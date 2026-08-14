import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getFamilyPortal } from "@/lib/family";
import { signFamilyContractV2 } from "./actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}
function statusLabel(status?: string | null) {
  if (status === "signed") return "Assinado";
  if (status === "sent") return "Aguardando assinatura";
  if (status === "cancelled") return "Cancelado";
  if (status === "expired") return "Expirado";
  return "Em preparação";
}

export default async function FamilyContractPage({ searchParams }: { searchParams: Promise<{ aluno?: string; erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { guardian, selectedChild, supabase, viewer } = await getFamilyPortal(query.aluno || null);
  if (!guardian?.active || !selectedChild) return <EmptyState title="Contrato indisponível" description="A administração precisa concluir o vínculo da família e da criança." />;
  const [{ data: subscriptions }, { data: profile }] = await Promise.all([
    supabase.from("subscriptions").select("id,status,plans(name)").eq("guardian_id", guardian.id).eq("student_id", selectedChild.student_id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("full_name").eq("id", viewer.user.id).maybeSingle(),
  ]);
  const subscriptionIds = (subscriptions ?? []).map((sub: any) => sub.id);
  const { data: contracts } = subscriptionIds.length
    ? await supabase.from("contracts").select("id,subscription_id,status,document_version,document_hash,signed_name,signed_at,created_at,updated_at").in("subscription_id", subscriptionIds).order("created_at", { ascending: false })
    : { data: [] as any[] };
  const planBySubscription = new Map((subscriptions ?? []).map((sub: any) => [sub.id, sub.plans?.name || "Plano CURIÓ"]));

  return <>
    <PageHeader eyebrow="Ninho da Família" title={`Contrato de ${selectedChild.student_name}`} description="Leia o contrato individual, baixe o PDF e registre a assinatura eletrônica sem precisar imprimir ou enviar arquivo." />
    {query.erro && <div className="form-message form-error">{query.erro}</div>}
    {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
    <div className="notice"><strong>Assinatura eletrônica no portal.</strong> O aceite registra sua conta autenticada, o nome confirmado, a versão do contrato, o conteúdo assinado, data/hora do servidor e hash de integridade. Não é necessário colar uma imagem fixa de assinatura manuscrita no PDF.</div>
    <section className="panel mt-16">
      {contracts?.length ? <div className="form-stack">{contracts.map((contract: any) => {
        const canSign = contract.status === "sent";
        return <article className="family-upload-card" key={contract.id}>
          <div className="flex space-between gap-8 wrap">
            <div><Badge tone={contract.status === "signed" ? "green" : contract.status === "sent" ? "yellow" : "neutral"}>{statusLabel(contract.status)}</Badge><h3>Contrato de prestação de serviços</h3><p>{planBySubscription.get(contract.subscription_id)}</p></div>
            <a className="button button-secondary button-small" href={`/familia/contrato/${contract.id}/pdf`} target="_blank" rel="noreferrer">Abrir / baixar PDF ↗</a>
          </div>
          <small className="muted">{contract.signed_at ? `Assinado em ${dt(contract.signed_at)}` : `Criado em ${dt(contract.created_at)}`}{contract.document_version ? ` · versão jurídica ${contract.document_version}` : ""}</small>
          {contract.status === "signed" && contract.document_hash ? <div className="asset-path mt-12">SHA-256: {contract.document_hash}</div> : null}
          {canSign ? <form action={signFamilyContractV2} className="form-stack mt-16">
            <input type="hidden" name="contractId" value={contract.id} />
            <input type="hidden" name="studentId" value={selectedChild.student_id} />
            <div className="field"><label>Seu nome completo para assinatura *</label><input className="input" name="signedName" defaultValue={profile?.full_name || ""} required autoComplete="name" /><small className="muted">Digite exatamente o nome completo cadastrado na sua conta.</small></div>
            <label className="consent-line"><input type="checkbox" name="accepted" required /> <span>Li o contrato disponibilizado e concordo com esta versão, autorizando o registro da minha assinatura eletrônica.</span></label>
            <button className="button button-primary" type="submit">Assinar contrato eletronicamente</button>
          </form> : contract.status === "draft" ? <p className="muted mt-12">O contrato desta matrícula ainda está em preparação.</p> : null}
        </article>;
      })}</div> : <EmptyState title="Contrato em preparação" description="A matrícula ainda não possui contrato individual disponível." />}
    </section>
  </>;
}
