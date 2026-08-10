"use client";

import { useFormStatus } from "react-dom";

export function MessageSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? "Enviando mensagem..." : "Enviar para a família"}
    </button>
  );
}
