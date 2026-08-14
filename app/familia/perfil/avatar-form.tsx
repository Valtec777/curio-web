"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { registerFamilyAvatar } from "./avatar-actions";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function extension(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function inferMime(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

export function FamilyAvatarForm({ studentId }: { studentId?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    let path = "";
    try {
      const value = formData.get("avatar");
      const file = value instanceof File && value.size > 0 ? value : null;
      if (!file) throw new Error("Escolha uma foto.");
      if (file.size > MAX_BYTES) throw new Error("A foto pode ter até 5 MB.");
      const mime = inferMime(file);
      if (!ALLOWED.has(mime)) throw new Error("Use PNG, JPG ou WEBP.");

      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sua sessão expirou. Entre novamente e tente outra vez.");

      path = `${userData.user.id}/familia-${Date.now()}.${extension(mime)}`;
      const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(path, file, { contentType: mime, upsert: false });
      if (uploadError) throw new Error("Não foi possível enviar a foto agora.");

      formData.delete("avatar");
      formData.set("uploadedFilePath", path);
      formData.set("uploadedMimeType", mime);
      formData.set("uploadedFileSize", String(file.size));
      await registerFamilyAvatar(formData);
    } catch (err) {
      if (path) {
        const supabase = createClient();
        await supabase.storage.from("profile-avatars").remove([path]);
      }
      setBusy(false);
      setError(err instanceof Error ? err.message : "Não foi possível trocar a foto.");
    }
  }

  return (
    <form action={submit} className="form-stack mt-12" aria-busy={busy}>
      <input type="hidden" name="studentId" value={studentId || ""} />
      {error ? <div className="form-message form-error">{error}</div> : null}
      <div className="flex gap-8 wrap">
        <label className="button button-secondary button-small profile-file-button">
          Escolher foto
          <input type="file" name="avatar" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" required hidden disabled={busy} />
        </label>
        <button className="button button-primary button-small" type="submit" disabled={busy}>{busy ? "Enviando..." : "Trocar foto"}</button>
      </div>
      <small className="muted">PNG, JPG ou WEBP · até 5 MB · envio direto ao armazenamento privado.</small>
    </form>
  );
}
