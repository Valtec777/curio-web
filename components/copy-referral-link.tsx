"use client";

import { useState } from "react";

export function CopyReferralLink({ url }: { url: string }) {
  const [status, setStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copiado.");
    } catch {
      setStatus("Selecione e copie o link acima.");
    }
  }

  async function share() {
    if (!navigator.share) {
      await copy();
      return;
    }

    try {
      await navigator.share({
        title: "Conheça o CURIÓ",
        text: "Quero te indicar o CURIÓ, um acompanhamento escolar personalizado.",
        url,
      });
      setStatus("Compartilhamento aberto.");
    } catch {
      // O usuário pode simplesmente fechar o compartilhamento.
    }
  }

  return (
    <div className="referral-link-box">
      <code>{url}</code>
      <div className="flex gap-8 wrap">
        <button className="button button-primary button-small" type="button" onClick={share}>Compartilhar</button>
        <button className="button button-secondary button-small" type="button" onClick={copy}>Copiar link</button>
      </div>
      <span className="copy-status" aria-live="polite">{status}</span>
    </div>
  );
}
