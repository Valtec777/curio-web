import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { AssessmentBuilder } from "./assessment-builder";

export default async function NewTeacherAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const query = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return null;

  const [{ data: subjects }, { data: grades }, { data: studentLinks }, { data: gradingSchemes }] = await Promise.all([
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("grades").select("id,name,sort_order").eq("active", true).order("sort_order"),
    supabase.from("teacher_students").select("student_id,students(preferred_name,full_name,school_name,grades(name))").eq("teacher_id", teacher.id).eq("active", true),
    supabase.from("grading_schemes").select("id,name,scale_min,scale_max").eq("active", true).order("name"),
  ]);

  const students = (studentLinks ?? []).filter((link: any) => link.students).map((link: any) => ({
    id: link.student_id,
    name: link.students.preferred_name || link.students.full_name || "Aluno",
    detail: link.students.grades?.name || link.students.school_name || "",
  }));

  return (
    <>
      <PageHeader
        eyebrow="Professor • Avaliações"
        title="Nova avaliação"
        description="Preencha manualmente ou importe um PDF do modelo Plumareli para trazer título, matéria, ano, data, conteúdo, observação e critério de nota de uma vez."
        action={<Link className="button button-secondary" href="/professor/avaliacoes">Voltar às avaliações</Link>}
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}

      <AssessmentBuilder
        subjects={(subjects ?? []).map((subject: any) => ({ id: subject.id, name: subject.name }))}
        grades={(grades ?? []).map((grade: any) => ({ id: grade.id, name: grade.name }))}
        students={students}
        gradingSchemes={(gradingSchemes ?? []).map((scheme: any) => ({ id: scheme.id, name: scheme.name, scaleMin: Number(scheme.scale_min), scaleMax: Number(scheme.scale_max) }))}
      />
    </>
  );
}
