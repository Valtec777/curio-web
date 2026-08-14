"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

type ServerAction = (formData: FormData) => Promise<void>;

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 110) || "arquivo";
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

export function PrivateFamilyUploadForm({
  action,
  studentId,
  kind,
  fileField,
  fileRequired = true,
  children,
  className = "form-stack",
  maxBytes = DEFAULT_MAX_BYTES,
}: {
  action: ServerAction;
  studentId: string;
  kind: string;
  fileField: string;
  fileRequired?: boolean;
  children: ReactNode;
  className?: string;
  maxBytes?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    let uploadedPath = "";
    try {
      const value = formData.get(fileField);
      const file = value instanceof File && value.size > 0 ? value : null;
      if (!file && fileRequired) throw new Error("Escolha um PDF ou imagem.");

      if (file) {
        if (file.size > maxBytes) throw new Error(`O arquivo pode ter até ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
        const mime = inferMime(file);
        if (!ALLOWED.has(mime)) throw new Error("Envie PDF, PNG, JPG ou WEBP.");

        const supabase = createClient();
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) throw new Error("Sua sessão expirou. Entre novamente e tente outra vez.");

        const targetStudentId = String(formData.get("studentId") || studentId).trim();
        if (!targetStudentId) throw new Error("Não foi possível identificar a criança deste envio.");
        uploadedPath = `${userData.user.id}/${targetStudentId}/${kind}/${Date.now()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("family-uploads").upload(uploadedPath, file, {
          contentType: mime,
          upsert: false,
        });
        if (uploadError) throw new Error("Não foi possível anexar o arquivo agora.");

        formData.set("uploadedFilePath", uploadedPath);
        formData.set("uploadedFileName", file.name);
        formData.set("uploadedMimeType", mime);
        formData.set("uploadedFileSize", String(file.size));
      }

      formData.delete(fileField);
      await action(formData);
    } catch (err) {
      if (uploadedPath) {
        const supabase = createClient();
        await supabase.storage.from("family-uploads").remove([uploadedPath]);
      }
      setBusy(false);
      setError(err instanceof Error ? err.message : "Não foi possível concluir o envio.");
    }
  }

  return (
    <form action={submit} className={className} aria-busy={busy}>
      {error ? <div className="form-message form-error">{error}</div> : null}
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
        {children}
      </fieldset>
      {busy ? <div className="notice"><strong>Enviando arquivo com segurança...</strong> Aguarde a confirmação antes de sair da página.</div> : null}
    </form>
  );
}
