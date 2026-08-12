"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";

function isActive(pathname: string, href: string) {
  if (["/admin", "/professor", "/aluno", "/familia"].includes(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function iconLabel(label: string) {
  const aliases: Record<string, string> = {
    "Notas e avaliações": "Configuração de Notas",
    "Cursos livres": "Cursos Livres",
    "Calendário": "Calendário Escolar",
    "Personagens": "Gestão de Mascotes",
    "Criar conteúdo": "Gerador",
    "Conteúdo da Escola": "Conteúdo",
  };
  return aliases[label] || label;
}

export function SidebarNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = isActive(pathname, href);
  const selectedStudent = searchParams.get("aluno");
  const destination = href.startsWith("/familia") && selectedStudent
    ? `${href}?aluno=${encodeURIComponent(selectedStudent)}`
    : href;

  return (
    <Link
      href={destination}
      className={`sidebar-nav-link${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      title={label}
    >
      <span className="sidebar-nav-icon" aria-hidden="true"><NavIcon label={iconLabel(label)} /></span>
      <span className="sidebar-nav-label">{label}</span>
    </Link>
  );
}
