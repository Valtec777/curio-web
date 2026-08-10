"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminContextActions() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin/cursos")) {
    return (
      <div className="admin-context-action-row">
        <div>
          <strong>Quer começar por um PDF, slide ou prompt?</strong>
          <span>Envie a fonte no Gerador e escolha “Curso livre”.</span>
        </div>
        <Link className="button button-primary button-small" href="/admin/gerador?tipo=course">Gerar curso livre</Link>
      </div>
    );
  }

  return null;
}
