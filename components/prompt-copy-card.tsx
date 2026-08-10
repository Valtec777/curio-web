"use client";

import { useState } from "react";

export function PromptCopyCard({ title, prompt }: { title: string; prompt: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="teacher-resource-card">
      <strong>{title}</strong>
      <p className="muted text-small">{prompt}</p>
      <button className="button button-secondary button-small" type="button" onClick={copy}>
        {copied ? "Copiado ✓" : "Copiar prompt"}
      </button>
    </article>
  );
}
