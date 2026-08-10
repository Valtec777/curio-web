import { randomUUID } from "node:crypto";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { MissionBuilder } from "./mission-builder";

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const query = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return null;

  const [{ data: subjects }, { data: grades }, { data: skills }, { data: characters }, { data: studentLinks }] = await Promise.all([
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("grades").select("id,name,sort_order").eq("active", true).order("sort_order"),
    supabase.from("skills").select("id,name").eq("active", true).order("name").limit(180),
    supabase.from("characters").select("id,name").eq("active", true).order("sort_order"),
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
        eyebrow="Professor • Missões"
        title="Nova Missão Cuca"
        description="Monte a missão em uma página própria e adicione quantas questões precisar, até 20 por missão."
        action={<Link className="button button-secondary" href="/professor/missoes">Voltar às missões</Link>}
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      <MissionBuilder
        idempotencyKey={randomUUID()}
        subjects={(subjects ?? []).map((item: any) => ({ id: item.id, name: item.name }))}
        grades={(grades ?? []).map((item: any) => ({ id: item.id, name: item.name }))}
        skills={(skills ?? []).map((item: any) => ({ id: item.id, name: item.name }))}
        characters={(characters ?? []).map((item: any) => ({ id: item.id, name: item.name }))}
        students={students}
      />
    </>
  );
}
