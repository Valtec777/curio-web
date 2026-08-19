"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerBrandLogo } from "@/app/admin/marca/actions";
import {
  BRAND_ASSET_BUCKET,
  BRAND_ASSET_MAX_BYTES,
  BRAND_ASSET_MIME_TYPES,
  BRAND_ASSET_PREFIX,
} from "@/lib/brand-assets";
import { createClient } from "@/lib/supabase/client";

const ALLOWED = new Set<string>(BRAND_ASSET_MIME_TYPES);

function extension(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function inferMime(file: File) {
  if (ALLOWED.has(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

export function AdminBrandLogoUpload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage("");
    setError("");
    let uploadedPath = "";

    try {
      const value = formData.get("brandLogo");
      const file = value instanceof File && value.size > 0 ? value : null;
      if (!file) throw new Error("Escolha uma imagem para a logo.");
      if (file.size > BRAND_ASSET_MAX_BYTES) throw new Error("A imagem pode ter até 5 MB.");

      const mime = inferMime(file);
      if (!ALLOWED.has(mime)) throw new Error("Use PNG, JPG ou WEBP.");

      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sua sessão expirou. Entre novamente e tente outra vez.");

      uploadedPath = `${BRAND_ASSET_PREFIX}/principal-${Date.now()}.${extension(mime)}`;
      const { error: uploadError } = await supabase.storage
        .from(BRAND_ASSET_BUCKET)
        .upload(uploadedPath, file, { contentType: mime, cacheControl: "31536000", upsert: false });
      if (uploadError) throw new Error("Não foi possível enviar a logo agora.");

      const registration = new FormData();
      registration.set("uploadedFilePath", uploadedPath);
      registration.set("uploadedMimeType", mime);
      registration.set("uploadedFileSize", String(file.size));

      const result = await registerBrandLogo(registration);
      if (!result.ok) {
        await supabase.storage.from(BRAND_ASSET_BUCKET).remove([uploadedPath]);
        uploadedPath = "";
        throw new Error(result.message);
      }

      uploadedPath = "";
      setMessage(result.message);
      setSelectedName("");
      router.refresh();
    } catch (err) {
      if (uploadedPath) {
        const supabase = createClient();
        await supabase.storage.from(BRAND_ASSET_BUCKET).remove([uploadedPath]);
      }
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a logo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="form-stack" aria-busy={busy}>
      <div>
        <h2>Trocar logo principal</h2>
        <p className="muted mb-0">Exporte do Canva e anexe aqui. Essa assinatura aparece apenas nos espaços amplos da marca; a logo reduzida dos menus internos continua preservada.</p>
      </div>
      {error ? <div className="form-message form-error">{error}</div> : null}
      {message ? <div className="form-message form-success">{message}</div> : null}
      <label className="button button-secondary">
        Escolher imagem
        <input
          type="file"
          name="brandLogo"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          required
          hidden
          disabled={busy}
          onChange={(event) => setSelectedName(event.currentTarget.files?.[0]?.name || "")}
        />
      </label>
      {selectedName ? <small><strong>Selecionada:</strong> {selectedName}</small> : <small className="muted">PNG, JPG ou WEBP · até 5 MB.</small>}
      <button className="button button-primary" type="submit" disabled={busy}>
        {busy ? "Atualizando..." : "Usar como logo principal"}
      </button>
      <p className="muted text-small mb-0">Dica: prefira fundo transparente e mantenha margem ao redor da arte para evitar cortes.</p>
    </form>
  );
}
