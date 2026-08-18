"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { restoreDefaultBrandLogo } from "@/app/admin/marca/actions";

export function AdminBrandLogoRestore() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function restore() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await restoreDefaultBrandLogo();
      if (!result.ok) throw new Error(result.message);
      setMessage(result.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível restaurar a logo original.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-stack">
      {error ? <div className="form-message form-error">{error}</div> : null}
      {message ? <div className="form-message form-success">{message}</div> : null}
      <button className="button button-secondary" type="button" onClick={restore} disabled={busy}>
        {busy ? "Restaurando..." : "Restaurar logo original"}
      </button>
    </div>
  );
}
