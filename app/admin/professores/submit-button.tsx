"use client";

import { useFormStatus } from "react-dom";

export function TeacherInviteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" type="submit" disabled={pending} aria-disabled={pending} aria-busy={pending}>
      {pending ? "Cadastrando professor…" : "Cadastrar e enviar acesso"}
    </button>
  );
}
