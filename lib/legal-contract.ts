import { getLegalProviderProfile, providerProfileMissingFields, providerTemplateVariables, renderLegalTemplate } from "@/lib/legal-templates";

function relation<T = any>(value: any): T | null { return (Array.isArray(value) ? value[0] : value) || null; }
function money(value: number | string | null | undefined) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0)); }
function date(value?: string | null) { if (!value) return "não definida"; return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`)); }
const entitlementVars: Record<string, string> = { meetings: "STUDENT_MEETINGS", family_meetings: "FAMILY_MEETINGS", missions: "MISSIONS", notebooks: "NOTEBOOKS", assessments: "ASSESSMENTS", materials: "MATERIALS", courses: "COURSES" };
function entitlementValue(row: any) { if (!row?.enabled) return "0"; return row.limit_per_cycle == null ? "sem limite definido" : String(row.limit_per_cycle); }

export async function buildFamilyContractDocument(supabase: any, contractId: string) {
  const { data: contract, error: contractError } = await supabase.from("contracts").select("id,subscription_id,status,document_version,document_snapshot,document_hash,signed_name,signed_at,signature_method").eq("id", contractId).maybeSingle();
  if (contractError || !contract) throw new Error("Contrato não encontrado.");
  if (contract.status === "signed" && contract.document_snapshot) return { contract, version: Number(contract.document_version || 1), title: "Contrato de Prestação de Serviços de Acompanhamento Escolar", snapshot: String(contract.document_snapshot), hash: contract.document_hash || "", signedName: contract.signed_name || "", signedAt: contract.signed_at || null, providerMissing: [] as string[] };

  const { data: subscription, error: subscriptionError } = await supabase.from("subscriptions").select("id,guardian_id,student_id,plan_id,status,agreed_monthly_price,starts_at,ends_at,plans(id,name,meetings_per_month,features),guardians(id,profile_id),students(id,full_name,preferred_name,grade_id,grades(name))").eq("id", contract.subscription_id).maybeSingle();
  if (subscriptionError || !subscription) throw new Error("Matrícula do contrato não encontrada.");
  const guardian: any = relation(subscription.guardians); const student: any = relation(subscription.students); const grade: any = relation(student?.grades); const plan: any = relation(subscription.plans);
  if (!guardian?.profile_id || !student?.id || !plan?.id) throw new Error("Dados da matrícula ainda estão incompletos.");

  const [partyResult, legalResult, entitlementResult] = await Promise.all([
    supabase.rpc("guardian_contract_party_data", { p_subscription_id: subscription.id }),
    supabase.from("legal_documents").select("id,title,version,body").eq("public_slug", "contrato-prestacao-servicos").eq("status", "published").eq("is_current", true).maybeSingle(),
    supabase.from("plan_entitlements").select("resource_key,limit_per_cycle,enabled").eq("plan_id", plan.id),
  ]);
  const party = Array.isArray(partyResult.data) ? partyResult.data[0] : partyResult.data; const legal = legalResult.data;
  if (!party?.guardian_name) throw new Error("Nome completo do responsável não está cadastrado.");
  if (!legal?.body) throw new Error("O contrato ainda não possui uma versão jurídica publicada.");

  const provider = await getLegalProviderProfile(supabase); const providerMissing = providerProfileMissingFields(provider);
  const values: Record<string, string> = {
    ...providerTemplateVariables(provider), GUARDIAN_NAME: party.guardian_name, GUARDIAN_CPF: party.guardian_cpf || "não informado", GUARDIAN_ADDRESS: party.guardian_address || "não informado", GUARDIAN_RELATIONSHIP: party.guardian_relationship || "responsável legal", STUDENT_NAME: party.student_name || student.full_name || student.preferred_name || "Aluno(a)", STUDENT_BIRTH_DATE: date(party.student_birth_date), STUDENT_GRADE: party.student_grade || grade?.name || "não informada", PLAN_NAME: plan.name || "Plano PLUMARELI", MONTHLY_PRICE: money(subscription.agreed_monthly_price), START_DATE: date(subscription.starts_at), SIGNED_NAME: "registrado no aceite eletrônico", SIGNED_AT: "registrado pelo servidor no ato da assinatura", CONTRACT_ID: contract.id, DOCUMENT_HASH: "ver evidência eletrônica vinculada ao contrato", STUDENT_MEETINGS: "0", FAMILY_MEETINGS: "0", MISSIONS: "0", NOTEBOOKS: "0", ASSESSMENTS: "0", MATERIALS: "0", COURSES: "0",
  };
  for (const row of entitlementResult.data ?? []) { const key = entitlementVars[row.resource_key]; if (key) values[key] = entitlementValue(row); }
  return { contract, version: Number(legal.version || 1), title: legal.title || "Contrato de Prestação de Serviços de Acompanhamento Escolar", snapshot: renderLegalTemplate(legal.body, values), hash: "", signedName: "", signedAt: null, providerMissing, expectedSignerName: party.guardian_name, studentId: student.id, guardianId: guardian.id };
}
