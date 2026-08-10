import Link from "next/link";
import { getCurrentTeacher } from "@/lib/teacher";
import { PageHeader, EmptyState, Badge } from "@/components/ui";

export default async function TeacherStudentsPage() {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) {
    return <EmptyState title="Perfil incompleto" description="Falta vincular o perfil de professor." />;
  }

  const { data: links } = await supabase
    .from("teacher_students")
    .select("student_id, students(id, preferred_name, full_name, school_name, status)")
    .eq("teacher_id", teacher.id)
    .eq("active", true);

  const visibleLinks = (links ?? []).filter((link: any) => Boolean(link.students));

  return (
    <>
      <PageHeader
        eyebrow="Professor"
        title="Meus alunos"
        description="Somente alunos explicitamente vinculados e disponíveis na operação aparecem aqui."
      />

      <section className="panel">
        {visibleLinks.length ? (
          <div className="grid-3">
            {visibleLinks.map((link: any) => (
              <Link className="mission-card" href={`/professor/alunos/${link.students.id}`} key={link.student_id}>
                <Badge tone="green">{link.students.status === "active" ? "Ativo" : link.students.status}</Badge>
                <h3>{link.students.preferred_name}</h3>
                <p>{link.students.school_name || "Escola a confirmar"}</p>
                <strong style={{ color: "var(--blue)" }}>Abrir mapa pedagógico →</strong>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhum aluno vinculado"
            description="O Admin precisa vincular pelo menos um aluno ativo a este professor."
          />
        )}
      </section>
    </>
  );
}
