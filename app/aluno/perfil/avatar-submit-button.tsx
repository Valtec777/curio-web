"use client";

import { useFormStatus } from "react-dom";

export function AvatarSubmitButton({ selected }: { selected: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`button button-small ${selected ? "button-secondary" : "button-primary"}`}
      type="submit"
      disabled={pending || selected}
      aria-disabled={pending || selected}
    >
      {pending ? "Salvando…" : selected ? "Avatar atual" : "Usar este avatar"}
    </button>
  );
}
