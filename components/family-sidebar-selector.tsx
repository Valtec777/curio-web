"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { enterStudentSpace } from "@/app/familia/access-actions";

type Child = {
  id: string;
  name: string;
  grade?: string | null;
  teacher?: string | null;
};

export function FamilySidebarSelector({ children }: { children: Child[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFromUrl = searchParams.get("aluno");
  const selected = children.find((child) => child.id === selectedFromUrl) || children[0];

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
    <div className="family-sidebar-child">
      <label htmlFor="family-child-select">Acompanhando</label>
      <select
        id="family-child-select"
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
        <button className="family-enter-student" type="submit">Entrar no espaço da criança →</button>
      </form>
    </div>
  );
}
