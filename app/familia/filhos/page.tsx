import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { enterStudentSpace } from "@/app/familia/access-actions";
import { getFamilyPortal } from "@/lib/family";

export default async function FamilyChildrenPage({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const query = await searchParams;
  const { children, selectedChild } = await getFamilyPortal(query.aluno || null);

  return (
    <>
      <PageHeader eyebrow="Ninho da Família" title={children.length === 1 ? "Meu filho" : "Meus filhos"} description="Cada criança mantém seu próprio acompanhamento, professor, matérias e espaço protegido." />
      {children.length ? (
        <div className="family-action-grid">
          {children.map((child) => (
            <article className="family-summary-card" key={child.student_id}>
              <div className="flex space-between gap-8 wrap">
                <Badge tone={child.student_status === "active" ? "green" : "neutral"}>{child.student_status === "active" ? "Ativo" : child.student_status}</Badge>
                {selectedChild?.student_id === child.student_id ? <Badge tone="blue">Acompanhando</Badge> : null}
              </div>
              <h3>{child.student_name}</h3>
              <p>{child.grade_name || "Ano não informado"}{child.school_name ? ` · ${child.school_name}` : ""}</p>
              <div className="profile-lines">
                <div><span>Professor(a)</span><strong>{child.teacher_name || "A definir"}</strong></div>
                <div><span>Matérias</span><strong>{(child.tracked_subjects ?? []).length ? (child.tracked_subjects ?? []).join(", ") : "Em definição"}</strong></div>
              </div>
              <div className="flex gap-8 wrap mt-12">
                <Link className="button button-secondary button-small" href={`/familia?aluno=${child.student_id}`}>Ver acompanhamento</Link>
                <form action={enterStudentSpace}><input type="hidden" name="studentId" value={child.student_id} /><button className="button button-primary button-small" type="submit">Entrar no espaço</button></form>
              </div>
            </article>
          ))}
        </div>
      ) : <EmptyState title="Nenhuma criança vinculada" description="A administração precisa concluir o vínculo desta família." />}
    </>
  );
}
