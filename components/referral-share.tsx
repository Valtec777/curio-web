"use client";

import { useState } from "react";

export function ReferralShare({ link, title = "Conheça o PLUMARELI" }: { link: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const message = `${title}: ${link}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url: link });
        setShared(true);
        window.setTimeout(() => setShared(false), 1800);
        return;
      }
      await copy();
    } catch {
      // Cancelar a folha nativa de compartilhamento não é erro para o usuário.
    }
  }

  return (
    <div className="referral-share">
      <div className="referral-link-box"><span>{link}</span></div>
      <div className="flex gap-8 wrap">
        <button className="button button-primary button-small" type="button" onClick={copy}>{copied ? "Link copiado" : "Copiar link"}</button>
        <button className="button button-secondary button-small" type="button" onClick={share}>{shared ? "Compartilhado" : "Compartilhar"}</button>
        <a className="button button-secondary button-small" href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp</a>
      </div>
      <small className="muted">O link registra a origem do contato; ele não confirma matrícula nem gera repasse automaticamente.</small>
    </div>
  );
}
