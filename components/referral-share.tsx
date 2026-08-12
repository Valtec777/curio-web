"use client";

import { useState } from "react";

export function ReferralShare({ link, title = "Conheça o CURIÓ" }: { link: string; title?: string }) {
  const [copied, setCopied] = useState(false);
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

  return (
    <div className="referral-share">
      <div className="referral-link-box"><span>{link}</span></div>
      <div className="flex gap-8 wrap">
        <button className="button button-primary button-small" type="button" onClick={copy}>{copied ? "Link copiado" : "Copiar link"}</button>
        <a className="button button-secondary button-small" href={whatsappHref} target="_blank" rel="noreferrer">Compartilhar no WhatsApp</a>
      </div>
    </div>
  );
}
