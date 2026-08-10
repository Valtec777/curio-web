"use client";

import { useFormStatus } from "react-dom";

export function AgendaSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" type="submit" disabled={pending} aria-disabled={pending} aria-busy={pending}>
      {pending ? "Criando encontro…" : "Criar encontro"}
    </button>
  );
}
