import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reviewPaymentReceipt } from "./actions";

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function monthLabel(value?: string | null) {
  if (!value) return "Mensalidade";
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export default async function AdminFinancePage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: receipts }, { data: payments }] = await Promise.all([
    supabase.from("payment_receipts").select("id,payment_id,guardian_id,file_path,file_name,status,review_note,created_at,reviewed_at").order("created_at", { ascending: false }).limit(120),
    supabase.from("payments").select("id,subscription_id,amount,due_date,paid_at,status").order("due_date", { ascending: false }).limit(300),
  ]);
  const paymentById = new Map((payments ?? []).map((item: any) => [item.id, item]));
  const subscriptionIds = [...new Set((payments ?? []).map((item: any) => item.subscription_id).filter(Boolean))];
  const guardianIds = [...new Set((receipts ?? []).map((item: any) => item.guardian_id).filter(Boolean))];

  const [{ data: subscriptions }, { data: guardians }] = await Promise.all([
    subscriptionIds.length
      ? supabase.from("subscriptions").select("id,guardian_id,student_id,plan_id,plans(name),students(preferred_name,full_name)").in("id", subscriptionIds)
      : Promise.resolve({ data: [] as any[] }),
    guardianIds.length
      ? supabase.from("guardians").select("id,profile_id,profiles(full_name,preferred_name)").in("id", guardianIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const subscriptionById = new Map((subscriptions ?? []).map((item: any) => [item.id, item]));
  const guardianById = new Map((guardians ?? []).map((item: any) => [item.id, item]));

  const signedByReceipt = new Map<string, string>();
  for (const receipt of receipts ?? []) {
    const { data } = await supabase.storage.from("payment-receipts").createSignedUrl(receipt.file_path, 600);
    if (data?.signedUrl) signedByReceipt.set(receipt.id, data.signedUrl);
  }

  const pendingReceipts = (receipts ?? []).filter((item: any) => item.status === "pending");
  const paidCount = (payments ?? []).filter((item: any) => item.status === "paid").length;
  const overdueCount = (payments ?? []).filter((item: any) => item.status === "overdue").length;

  return (
    <>
      <PageHeader
        eyebrow="Admin • Operação"
        title="Financeiro"
        description="A família envia o comprovante do banco; a equipe confere destinatário, valor, data e competência antes de confirmar a mensalidade."
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="stats-grid">
        <StatCard value={pendingReceipts.length} label="Comprovantes para conferir" />
        <StatCard value={paidCount} label="Pagamentos confirmados" />
        <StatCard value={overdueCount} label="Mensalidades vencidas" />
        <StatCard value={payments?.length ?? 0} label="Cobranças registradas" />
      </div>

      <section className="panel family-highlight">
        <strong>Checklist antes de aprovar</strong>
        <p className="mb-0">Abra o comprovante e confirme: destinatário/conta Pix correta, valor esperado, data da transferência e mês/competência correspondente. Verifique também se o mesmo comprovante não está sendo reapresentado para outra mensalidade.</p>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Comprovantes aguardando conferência</h2><p>A aprovação só deve acontecer depois da conferência no comprovante e, quando necessário, no extrato bancário. Aprovar marca a mensalidade como paga em uma única operação.</p></div></div>
        {pendingReceipts.length ? (
          <div className="form-stack">
            {pendingReceipts.map((receipt: any) => {
              const payment: any = paymentById.get(receipt.payment_id);
              const subscription: any = payment ? subscriptionById.get(payment.subscription_id) : null;
              const guardian: any = guardianById.get(receipt.guardian_id);
              return (
                <article className="mission-card" key={receipt.id}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <strong>{guardian?.profiles?.preferred_name || guardian?.profiles?.full_name || "Família"}</strong>
                      <p>{subscription?.students?.preferred_name || subscription?.students?.full_name || "Criança"} • {subscription?.plans?.name || "Plano CURIÓ"}</p>
                    </div>
                    <Badge tone="yellow">Conferir comprovante</Badge>
                  </div>
                  <div className="record-meta-grid">
                    <span><small>Competência esperada</small><strong>{monthLabel(payment?.due_date)}</strong></span>
                    <span><small>Valor esperado</small><strong>{money(payment?.amount)}</strong></span>
                    <span><small>Arquivo enviado</small><strong>{receipt.file_name}</strong></span>
                    <span><small>Situação da cobrança</small><strong>{payment?.status || "pendente"}</strong></span>
                  </div>
                  {signedByReceipt.get(receipt.id) && <p><a className="button button-secondary button-small" href={signedByReceipt.get(receipt.id)} target="_blank" rel="noreferrer">Abrir comprovante bancário</a></p>}
                  <form action={reviewPaymentReceipt} className="form-stack compact-form">
                    <input type="hidden" name="receiptId" value={receipt.id} />
                    <div className="field"><label>Observação <span className="field-optional">opcional</span></label><input className="input" name="note" placeholder="Ex.: Pix confirmado no extrato / comprovante é de outro mês / destinatário incorreto" /></div>
                    <div className="plan-admin-actions">
                      <button className="button button-primary button-small" type="submit" name="decision" value="approve">Confirmar pagamento</button>
                      <button className="button button-danger button-small" type="submit" name="decision" value="reject">Solicitar novo comprovante</button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Nenhum comprovante aguardando" description="Quando uma família enviar um comprovante bancário, ele aparecerá aqui para conferência." />}
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Histórico recente</h2><p>Últimos comprovantes já analisados.</p></div></div>
        {(receipts ?? []).filter((item: any) => item.status !== "pending").length ? (
          <div className="form-stack">
            {(receipts ?? []).filter((item: any) => item.status !== "pending").slice(0, 30).map((receipt: any) => {
              const payment: any = paymentById.get(receipt.payment_id);
              const guardian: any = guardianById.get(receipt.guardian_id);
              return <article className="mission-card" key={receipt.id}><div className="flex space-between gap-8 wrap"><div><strong>{guardian?.profiles?.preferred_name || guardian?.profiles?.full_name || "Família"}</strong><p>{monthLabel(payment?.due_date)} • {money(payment?.amount)}</p></div><Badge tone={receipt.status === "approved" ? "green" : "pink"}>{receipt.status === "approved" ? "Confirmado" : "Reenviar"}</Badge></div>{receipt.review_note && <small className="muted">{receipt.review_note}</small>}</article>;
            })}
          </div>
        ) : <p className="muted">Ainda não há comprovantes analisados.</p>}
      </section>
    </>
  );
}
