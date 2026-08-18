"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CHARACTER_ASSET_BUCKET, registerMascotImage } from "@/app/admin/mascotes/actions";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

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

type AdminMascotImageUploadProps = {
  characterId: string;
  slug: string;
  name: string;
};

export function AdminMascotImageUpload({ characterId, slug, name }: AdminMascotImageUploadProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage("");
    setError("");
    let uploadedPath = "";

    try {
      const value = formData.get("mascotImage");
      const file = value instanceof File && value.size > 0 ? value : null;
      if (!file) throw new Error("Escolha uma imagem.");
      if (file.size > MAX_BYTES) throw new Error("A imagem pode ter até 5 MB.");

      const mime = inferMime(file);
      if (!ALLOWED.has(mime)) throw new Error("Use PNG, JPG ou WEBP.");

      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sua sessão expirou. Entre novamente e tente outra vez.");

      uploadedPath = `${slug}/principal-${Date.now()}.${extension(mime)}`;
      const { error: uploadError } = await supabase.storage
        .from(CHARACTER_ASSET_BUCKET)
        .upload(uploadedPath, file, { contentType: mime, cacheControl: "31536000", upsert: false });
      if (uploadError) throw new Error("Não foi possível enviar a imagem agora.");

      const registration = new FormData();
      registration.set("characterId", characterId);
      registration.set("uploadedFilePath", uploadedPath);
      registration.set("uploadedMimeType", mime);
      registration.set("uploadedFileSize", String(file.size));

      const result = await registerMascotImage(registration);
      if (!result.ok) {
        await supabase.storage.from(CHARACTER_ASSET_BUCKET).remove([uploadedPath]);
        uploadedPath = "";
        throw new Error(result.message);
      }

      uploadedPath = "";
      setMessage(result.message);
      router.refresh();
    } catch (err) {
      if (uploadedPath) {
        const supabase = createClient();
        await supabase.storage.from(CHARACTER_ASSET_BUCKET).remove([uploadedPath]);
      }
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="form-stack" aria-busy={busy}>
      <div>
        <strong>Trocar imagem de {name}</strong>
        <p className="muted text-small mb-0">Selecione o arquivo e salve. A nova imagem passa a ser usada pelo cadastro central do mascote.</p>
      </div>
      {error ? <div className="form-message form-error">{error}</div> : null}
      {message ? <div className="form-message form-success">{message}</div> : null}
      <div className="flex gap-8 wrap align-center">
        <label className="button button-secondary button-small">
          Escolher imagem
          <input
            type="file"
            name="mascotImage"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            required
            hidden
            disabled={busy}
          />
        </label>
        <button className="button button-primary button-small" type="submit" disabled={busy}>
          {busy ? "Atualizando..." : "Usar esta imagem"}
        </button>
      </div>
      <small className="muted">PNG, JPG ou WEBP · até 5 MB.</small>
    </form>
  );
}
