"use client";

import { useFormStatus } from "react-dom";

export function EnrollmentSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="button button-primary button-block"
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Criando matrícula…" : "Criar matrícula e enviar primeiro acesso"}
    </button>
  );
}
