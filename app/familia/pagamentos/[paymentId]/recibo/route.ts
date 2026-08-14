import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createTextPdf } from "@/lib/simple-pdf";
import { getLegalProviderProfile, providerProfileMissingFields } from "@/lib/legal-templates";

function relation<T = any>(value: any): T | null { return (Array.isArray(value) ? value[0] : value) || null; }
function money(v: unknown) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0)); }
function dateTime(v?: string | null) { return v ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(v)) : "-"; }
function competence(v?: string | null) { return v ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${String(v).slice(0,10)}T12:00:00Z`)) : "mensalidade"; }

export async function GET(_request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const viewer = await requireRole("guardian"); const { paymentId } = await params; const supabase = await createClient();
  const { data: guardian } = await supabase.from("guardians").select("id,profile_id").eq("profile_id", viewer.user.id).maybeSingle();
  if (!guardian) return new NextResponse("Responsável não identificado.", { status: 403 });
  const { data: payment } = await supabase.from("payments").select("id,subscription_id,amount,due_date,paid_at,status,provider,subscriptions(id,guardian_id,student_id,plan_id,plans(name),students(full_name,preferred_name))").eq("id", paymentId).maybeSingle();
  const subscription: any = relation(payment?.subscriptions);
  if (!payment || !subscription || subscription.guardian_id !== guardian.id || payment.status !== "paid") return new NextResponse("Recibo indisponível.", { status: 404 });
  const [{ data: partyRows }, provider] = await Promise.all([supabase.rpc("guardian_contract_party_data", { p_subscription_id: subscription.id }), getLegalProviderProfile(supabase)]);
  const party: any = Array.isArray(partyRows) ? partyRows[0] : partyRows; const missing = providerProfileMissingFields(provider);
  if (missing.length) return new NextResponse("A identificação jurídica da prestadora ainda não está completa.", { status: 409 });
  const student: any = relation(subscription.students); const plan: any = relation(subscription.plans); const issuedAt = new Date().toISOString();
  const core = [`RECIBO Nº ${payment.id.slice(0, 8).toUpperCase()}`,"",`Recebi de ${party?.guardian_name || "Responsável"}, CPF ${party?.guardian_cpf || "não informado"}, a quantia de ${money(payment.amount)}, referente à ${competence(payment.due_date)} do acompanhamento escolar de ${party?.student_name || student?.full_name || student?.preferred_name || "Aluno(a)"}, plano ${plan?.name || "CURIÓ"}.`,"",`Forma de pagamento registrada: ${payment.provider || "pagamento confirmado pela administração"}.`,`Data de confirmação: ${dateTime(payment.paid_at)}.`,`Identificador do pagamento: ${payment.id}.`,"",`Prestadora: ${provider.legalName}`,`CPF/CNPJ: ${provider.taxId}`,`Endereço para comunicações: ${provider.address}`,`E-mail: ${provider.email}`,`Telefone: ${provider.phone}`,"","Este recibo comprova o recebimento do valor indicado no âmbito da prestação de serviços. O tratamento tributário e eventual obrigação de documento fiscal seguem o enquadramento da prestadora e a legislação aplicável.","",`Emitido eletronicamente pelo ${provider.brandName} em ${dateTime(issuedAt)}.`].join("\n");
  const hash = createHash("sha256").update(core, "utf8").digest("hex"); const pdf = createTextPdf({ title: "Recibo de Pagamento", body: `${core}\nCódigo de verificação (SHA-256): ${hash}`, footer: `${provider.brandName} · recibo eletrônico` });
  return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="recibo-${payment.id}.pdf"`, "Cache-Control": "private, no-store" } });
}
