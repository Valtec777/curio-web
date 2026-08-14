import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildFamilyContractDocument } from "@/lib/legal-contract";
import { createTextPdf } from "@/lib/simple-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole("guardian");
  const { id } = await params;
  const supabase = await createClient();
  try {
    const document = await buildFamilyContractDocument(supabase, id);
    const evidence = document.contract.status === "signed" ? `\n\nEVIDÊNCIA ELETRÔNICA DA ASSINATURA\nNome confirmado: ${document.signedName || "-"}\nData/hora registrada: ${document.signedAt || "-"}\nMétodo: ${document.contract.signature_method || "authenticated_portal"}\nHash SHA-256 do snapshot assinado: ${document.hash || "-"}` : "\n\nDOCUMENTO AINDA NÃO ASSINADO. O conteúdo será congelado e receberá hash no aceite eletrônico.";
    const pdf = createTextPdf({ title: document.title, body: `${document.snapshot}${evidence}`, footer: "CURIÓ · contrato individual" });
    return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="contrato-${id}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return new NextResponse(error instanceof Error ? error.message : "Contrato indisponível.", { status: 404 }); }
}
