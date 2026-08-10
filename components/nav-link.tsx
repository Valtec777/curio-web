"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  };
  return aliases[label] || label;
}

export function SidebarNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      className={`sidebar-nav-link${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      title={label}
    >
      <span className="sidebar-nav-icon" aria-hidden="true"><NavIcon label={iconLabel(label)} /></span>
      <span className="sidebar-nav-label">{label}</span>
    </Link>
  );
}
