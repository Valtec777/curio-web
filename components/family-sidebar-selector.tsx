"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { enterStudentSpace } from "@/app/familia/access-actions";

type Child = {
  id: string;
  name: string;
  grade?: string | null;
  teacher?: string | null;
};

export function FamilySidebarSelector({
  children,
  variant = "sidebar",
}: {
  children: Child[];
  variant?: "sidebar" | "mobile";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFromUrl = searchParams.get("aluno");
  const selected = children.find((child) => child.id === selectedFromUrl) || children[0];
  const selectId = variant === "mobile" ? "family-child-select-mobile" : "family-child-select-sidebar";

  if (!selected) return null;

  function changeStudent(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("aluno", id);
    params.delete("erro");
    params.delete("sucesso");
    params.delete("conversa");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className={`family-sidebar-child family-sidebar-child-${variant}`}>
      <label htmlFor={selectId}>Acompanhando</label>
      <select
        id={selectId}
        value={selected.id}
        onChange={(event) => changeStudent(event.target.value)}
        aria-label="Escolher criança acompanhada"
      >
        {children.map((child) => <option value={child.id} key={child.id}>{child.name}</option>)}
      </select>
      <div className="family-sidebar-child-meta">
        <strong>{selected.name}</strong>
        <small>{selected.grade || "Ano escolar"}{selected.teacher ? ` · ${selected.teacher}` : ""}</small>
      </div>
      <form action={enterStudentSpace}>
        <input type="hidden" name="studentId" value={selected.id} />
        <button className="family-enter-student" type="submit">Entrar no espaço da criança</button>
      </form>
    </div>
  );
}
