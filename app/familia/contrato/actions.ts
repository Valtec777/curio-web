"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getFamilyPortal } from "@/lib/family";
import { buildFamilyContractDocument } from "@/lib/legal-contract";
import { normalizeLegalName } from "@/lib/legal-templates";

function familyPath(studentId: string, key: "erro" | "sucesso", message: string) { const params = new URLSearchParams({ aluno: studentId, [key]: message }); return `/familia/contrato?${params.toString()}`; }

export async function signFamilyContractV2(formData: FormData) {
  const parsed = z.object({ contractId: z.string().uuid(), studentId: z.string().uuid(), signedName: z.string().trim().min(3).max(180), accepted: z.literal("on") }).safeParse({ contractId: formData.get("contractId"), studentId: formData.get("studentId"), signedName: formData.get("signedName"), accepted: formData.get("accepted") });
  if (!parsed.success) redirect(familyPath(String(formData.get("studentId") || ""), "erro", "Digite seu nome completo e confirme a concordância."));
  const { selectedChild, supabase, viewer } = await getFamilyPortal(parsed.data.studentId);
  if (selectedChild?.student_id !== parsed.data.studentId) redirect("/familia/contrato?erro=" + encodeURIComponent("Criança não vinculada."));
  let document; try { document = await buildFamilyContractDocument(supabase, parsed.data.contractId); } catch (error) { redirect(familyPath(parsed.data.studentId, "erro", error instanceof Error ? error.message : "Contrato indisponível.")); }
  if (document.contract.status !== "sent") redirect(familyPath(parsed.data.studentId, "erro", "Este contrato não está disponível para uma nova assinatura."));
  if (document.providerMissing.length) redirect(familyPath(parsed.data.studentId, "erro", "A Administração ainda precisa completar os dados jurídicos da prestadora antes da assinatura."));
  if (normalizeLegalName(parsed.data.signedName) !== normalizeLegalName(document.expectedSignerName)) redirect(familyPath(parsed.data.studentId, "erro", `Digite seu nome completo como cadastrado: ${document.expectedSignerName}.`));
  const hash = createHash("sha256").update(document.snapshot, "utf8").digest("hex");
  const evidence = { method: "authenticated_portal", user_id: viewer.user.id, signer_name: parsed.data.signedName, contract_id: parsed.data.contractId, document_version: document.version, document_hash_algorithm: "SHA-256", document_hash: hash };
  const { data, error } = await supabase.rpc("sign_guardian_contract", { p_contract_id: parsed.data.contractId, p_signed_name: parsed.data.signedName, p_document_version: document.version, p_document_snapshot: document.snapshot, p_document_hash: hash, p_evidence: evidence });
  if (error || data !== true) redirect(familyPath(parsed.data.studentId, "erro", "Não foi possível registrar a assinatura eletrônica."));
  revalidatePath("/familia/contrato"); revalidatePath("/admin/documentos");
  redirect(familyPath(parsed.data.studentId, "sucesso", "Contrato assinado eletronicamente. O conteúdo e o hash da versão assinada foram preservados."));
}
