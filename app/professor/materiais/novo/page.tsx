import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { MaterialBuilder } from "./material-builder";

export default async function NewTeacherMaterialPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; erro?: string }>;
}) {
  const query = await searchParams;
  const kind = query.tipo === "material" ? "material" : "notebook";
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return null;

  const [{ data: subjects }, { data: grades }, { data: studentLinks }] = await Promise.all([
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("grades").select("id,name,sort_order").eq("active", true).order("sort_order"),
    supabase.from("teacher_students").select("student_id,students(preferred_name,full_name,school_name,grades(name))").eq("teacher_id", teacher.id).eq("active", true),
  ]);

  const students = (studentLinks ?? []).filter((link: any) => link.students).map((link: any) => ({
    id: link.student_id,
    name: link.students.preferred_name || link.students.full_name || "Aluno",
    detail: link.students.grades?.name || link.students.school_name || "",
  }));

  return (
    <>
      <PageHeader
        eyebrow="Professor • Materiais"
        title={kind === "notebook" ? "Nova atividade / Caderno Plumareli" : "Novo material de apoio"}
        description="Você pode preencher manualmente ou importar um PDF criado a partir do modelo Plumareli. O PDF nunca publica nem escolhe alunos sozinho."
        action={<Link className="button button-secondary" href="/professor/materiais">Voltar aos materiais</Link>}
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}

      <MaterialBuilder
        initialKind={kind}
        subjects={(subjects ?? []).map((subject: any) => ({ id: subject.id, name: subject.name }))}
        grades={(grades ?? []).map((grade: any) => ({ id: grade.id, name: grade.name }))}
        students={students}
      />
    </>
  );
}
