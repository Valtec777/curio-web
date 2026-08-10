import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getFamilyPortal } from "@/lib/family";
import { submitPaymentReceipt } from "./actions";

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function monthLabel(value?: string | null) {
  if (!value) return "Mensalidade";
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function receiptLabel(status?: string | null) {
  if (status === "approved") return "Comprovante aprovado";
  if (status === "rejected") return "Comprovante precisa ser reenviado";
  return "Aguardando conferência";
}

export default async function FamilyPaymentsPage({ searchParams }: { searchParams: Promise<{ aluno?: string; erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { guardian, selectedChild, supabase } = await getFamilyPortal(query.aluno || null);
  if (!guardian?.active || !selectedChild) return <EmptyState title="Perfil da família incompleto" description="A administração precisa concluir o vínculo do responsável e da criança." />;

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("id,status,agreed_monthly_price,starts_at,plans(name),students(preferred_name,full_name)")
    .eq("guardian_id", guardian.id)
    .eq("student_id", selectedChild.student_id)
    .order("created_at", { ascending: false });
  const subscriptionIds = (subscriptions ?? []).map((item: any) => item.id);
  const [{ data: payments }, { data: receipts }] = await Promise.all([
    subscriptionIds.length
      ? supabase.from("payments").select("id,subscription_id,amount,due_date,paid_at,status,created_at").in("subscription_id", subscriptionIds).order("due_date", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("payment_receipts").select("id,payment_id,file_path,file_name,status,review_note,created_at,reviewed_at").eq("guardian_id", guardian.id).order("created_at", { ascending: false }),
  ]);

  const subscriptionById = new Map((subscriptions ?? []).map((item: any) => [item.id, item]));
  const latestReceiptByPayment = new Map<string, any>();
  for (const receipt of receipts ?? []) if (!latestReceiptByPayment.has(receipt.payment_id)) latestReceiptByPayment.set(receipt.payment_id, receipt);

  const signedByReceipt = new Map<string, string>();
  for (const receipt of receipts ?? []) {
    if (!payments?.some((payment: any) => payment.id === receipt.payment_id)) continue;
    const { data } = await supabase.storage.from("payment-receipts").createSignedUrl(receipt.file_path, 600);
    if (data?.signedUrl) signedByReceipt.set(receipt.id, data.signedUrl);
  }

  return (
    <>
      <PageHeader
        eyebrow="Ninho da Família"
        title={`Pagamento de ${selectedChild.student_name}`}
        description="Escolha a mensalidade correta, anexe o comprovante do Pix e acompanhe a conferência da equipe."
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="panel family-highlight">
        <strong>Confirmação humana</strong>
        <p className="mb-0">O comprovante não marca a mensalidade como paga sozinho. A equipe CURIÓ confere a entrada no banco e só então confirma o mês.</p>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Mensalidades</h2><p>O comprovante fica associado à competência/mês escolhido abaixo.</p></div></div>
        {payments?.length ? (
          <div className="form-stack">
            {payments.map((payment: any) => {
              const subscription: any = subscriptionById.get(payment.subscription_id);
              const receipt = latestReceiptByPayment.get(payment.id);
              const paid = payment.status === "paid";
              const canSend = !paid && receipt?.status !== "pending";
              return (
                <article className="family-upload-card" key={payment.id}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <strong>{monthLabel(payment.due_date)}</strong>
                      <p>{selectedChild.student_name} • {subscription?.plans?.name || "Plano CURIÓ"}</p>
                    </div>
                    <Badge tone={paid ? "green" : payment.status === "overdue" ? "pink" : "yellow"}>{paid ? "Pagamento confirmado" : payment.status === "overdue" ? "Vencido" : "Aguardando pagamento"}</Badge>
                  </div>
                  <p className="mb-0"><strong>{money(payment.amount)}</strong></p>

                  {receipt && (
                    <div className={`form-message ${receipt.status === "rejected" ? "form-error" : receipt.status === "approved" ? "form-success" : ""}`}>
                      <strong>{receiptLabel(receipt.status)}</strong>
                      <div className="text-small">{receipt.file_name}{receipt.review_note ? ` • ${receipt.review_note}` : ""}</div>
                      {signedByReceipt.get(receipt.id) && <a href={signedByReceipt.get(receipt.id)} target="_blank" rel="noreferrer">Ver comprovante enviado</a>}
                    </div>
                  )}

                  {canSend && (
                    <form action={submitPaymentReceipt} className="form-stack">
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <div className="field">
                        <label>{receipt?.status === "rejected" ? `Enviar novo comprovante de ${monthLabel(payment.due_date)}` : `Anexar comprovante de ${monthLabel(payment.due_date)}`}</label>
                        <input className="input" type="file" name="receiptFile" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" required />
                        <small className="muted">PDF, PNG, JPG ou WEBP · até 10 MB.</small>
                      </div>
                      <button className="button button-primary button-small" type="submit">Enviar para conferência</button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Nenhuma mensalidade cadastrada" description={`Quando houver cobranças vinculadas ao plano de ${selectedChild.student_name}, elas aparecerão aqui.`} />}
      </section>
    </>
  );
}
