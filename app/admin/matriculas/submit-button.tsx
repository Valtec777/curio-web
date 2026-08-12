"use client";

import { useFormStatus } from "react-dom";

export function EnrollmentSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="button button-primary button-block enrollment-submit"
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Concluindo matrícula…" : "Concluir matrícula e enviar acesso"}
    </button>
  );
}
