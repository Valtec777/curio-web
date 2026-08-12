"use client";

import { useFormStatus } from "react-dom";

export function MissionSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? "Salvando missão…" : "Salvar Missão Cuca"}
    </button>
  );
}
