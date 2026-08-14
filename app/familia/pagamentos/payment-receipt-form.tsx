"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitPaymentReceipt } from "./actions";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 110) || "comprovante";
}

function inferMime(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  return "";
}

export function PaymentReceiptForm({ paymentId, label }: { paymentId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    try {
      const value = formData.get("receiptFile");
      const file = value instanceof File && value.size > 0 ? value : null;
      if (!file) throw new Error("Escolha o comprovante.");
      if (file.size > MAX_BYTES) throw new Error("O comprovante deve ter até 10 MB.");
      const mime = inferMime(file);
      if (!ALLOWED.has(mime)) throw new Error("Envie PDF, PNG, JPG ou WEBP.");

      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sua sessão expirou. Entre novamente e tente outra vez.");

      const path = `${userData.user.id}/${paymentId}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("payment-receipts").upload(path, file, { contentType: mime, upsert: false });
      if (uploadError) throw new Error("Não foi possível anexar o comprovante agora.");

      formData.delete("receiptFile");
      formData.set("receiptFilePath", path);
      formData.set("receiptFileName", file.name);
      formData.set("receiptMimeType", mime);
      formData.set("receiptFileSize", String(file.size));
      await submitPaymentReceipt(formData);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Não foi possível enviar o comprovante.");
    }
  }

  return (
    <form action={submit} className="form-stack">
      <input type="hidden" name="paymentId" value={paymentId} />
      {error ? <div className="form-message form-error">{error}</div> : null}
      <div className="field">
        <label>{label}</label>
        <input className="input" type="file" name="receiptFile" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" required disabled={busy} />
        <small className="muted">PDF, PNG, JPG ou WEBP · até 10 MB. O arquivo vai direto para o armazenamento privado.</small>
      </div>
      <button className="button button-primary button-small" type="submit" disabled={busy}>{busy ? "Enviando..." : "Enviar para conferência"}</button>
    </form>
  );
}
