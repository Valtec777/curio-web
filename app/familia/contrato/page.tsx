import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { signFamilyContract } from "@/app/familia/actions";
import { getFamilyPortal } from "@/lib/family";

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
  const { guardian, selectedChild, supabase } = await getFamilyPortal(query.aluno || null);
  if (!guardian?.active || !selectedChild) return <EmptyState title="Contrato indisponível" description="A administração precisa concluir o vínculo da família e da criança." />;

  const { data: subscriptions } = await supabase.from("subscriptions").select("id,status,plans(name)").eq("guardian_id", guardian.id).eq("student_id", selectedChild.student_id).order("created_at", { ascending: false });
  const subscriptionIds = (subscriptions ?? []).map((sub: any) => sub.id);
  const { data: contracts } = subscriptionIds.length
    ? await supabase.from("contracts").select("id,subscription_id,status,document_path,signed_at,created_at,updated_at").in("subscription_id", subscriptionIds).order("created_at", { ascending: false })
    : { data: [] as any[] };
  const planBySubscription = new Map((subscriptions ?? []).map((sub: any) => [sub.id, sub.plans?.name || "Plano CURIÓ"]));
  const urls = new Map<string, string>();
  for (const contract of contracts ?? []) {
    if (!contract.document_path) continue;
    const { data } = await supabase.storage.from("generated-documents").createSignedUrl(contract.document_path, 60 * 20);
    if (data?.signedUrl) urls.set(contract.id, data.signedUrl);
  }

  return (
    <>
      <PageHeader eyebrow="Ninho da Família" title={`Contrato de ${selectedChild.student_name}`} description="Leia o documento disponibilizado pela administração e acompanhe a situação da assinatura." />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="notice">A assinatura pelo portal registra a ciência, o usuário autenticado, a data e o horário no CURIÓ. A validade jurídica do modelo final e eventual necessidade de assinatura qualificada/externa devem ser confirmadas na revisão jurídica dos documentos.</div>

      <section className="panel mt-16">
        {contracts?.length ? <div className="form-stack">{contracts.map((contract: any) => {
          const canSign = contract.status === "sent" && Boolean(contract.document_path);
          return (
            <article className="family-upload-card" key={contract.id}>
              <div className="flex space-between gap-8 wrap">
                <div><Badge tone={contract.status === "signed" ? "green" : contract.status === "sent" ? "yellow" : "neutral"}>{statusLabel(contract.status)}</Badge><h3>Contrato de prestação de serviços</h3><p>{planBySubscription.get(contract.subscription_id)}</p></div>
                {urls.get(contract.id) ? <a className="button button-secondary button-small" href={urls.get(contract.id)} target="_blank" rel="noreferrer">Abrir contrato ↗</a> : null}
              </div>
              <small className="muted">{contract.signed_at ? `Assinado em ${dt(contract.signed_at)}` : `Criado em ${dt(contract.created_at)}`}</small>
              {canSign ? (
                <form action={signFamilyContract} className="form-stack mt-16">
                  <input type="hidden" name="contractId" value={contract.id} />
                  <input type="hidden" name="studentId" value={selectedChild.student_id} />
                  <label className="consent-line"><input type="checkbox" name="accepted" required /> <span>Li o documento disponibilizado e confirmo minha ciência e concordância para registrar a assinatura no portal.</span></label>
                  <button className="button button-primary" type="submit">Assinar no portal</button>
                </form>
              ) : contract.status === "draft" ? <p className="muted mt-12">O contrato desta matrícula ainda está em preparação. A administração disponibilizará o documento assim que estiver pronto.</p> : null}
            </article>
          );
        })}</div> : <EmptyState title="Contrato em preparação" description="O contrato desta matrícula ainda não foi gerado. A administração disponibilizará o documento assim que estiver pronto." />}
      </section>
    </>
  );
}
