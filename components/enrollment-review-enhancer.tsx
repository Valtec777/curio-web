"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function fieldValue(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) return field.value.trim();
  if (field instanceof HTMLSelectElement) return field.value.trim();
  return "";
}

function selectedText(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLSelectElement) || !field.value) return "";
  return field.selectedOptions[0]?.textContent?.trim() || "";
}

export function EnrollmentReviewEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/admin/matriculas") return;
    const form = document.querySelector<HTMLFormElement>("form.enrollment-form");
    const review = form?.querySelector<HTMLElement>(".review-checks");
    const rows = review ? Array.from(review.querySelectorAll<HTMLElement>("span")) : [];
    if (!form || rows.length < 5) return;

    review?.setAttribute("aria-live", "polite");
    review?.setAttribute("aria-label", "Resumo automático da matrícula");

    const update = () => {
      const child = fieldValue(form, "childPreferredName") || fieldValue(form, "childName");
      const grade = selectedText(form, "gradeId");
      const guardian = fieldValue(form, "preferredName") || fieldValue(form, "fullName");
      const email = fieldValue(form, "email");
      const secondGuardian = fieldValue(form, "secondGuardianName");
      const teacher = selectedText(form, "teacherId");
      const plan = selectedText(form, "planId");

      rows[0].textContent = child
        ? `Criança: ${child}${grade ? ` · ${grade}` : " · confira o ano escolar"}`
        : "Criança: confira nome e ano escolar";
      rows[1].textContent = guardian
        ? `Família: ${guardian}${email ? ` · ${email}` : ""}${secondGuardian ? ` · + ${secondGuardian}` : ""}`
        : "Família: confira responsável e acesso";
      rows[2].textContent = teacher ? `Professor: ${teacher}` : "Professor: selecione quem acompanhará";
      rows[3].textContent = plan ? `Plano: ${plan}` : "Plano: selecione o plano da matrícula";
      rows[4].textContent = "Proteção contra cadastro duplicado ativa";
    };

    update();
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
    };
  }, [pathname]);

  return null;
}
