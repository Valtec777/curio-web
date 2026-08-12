import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { duplicateMission } from "@/app/professor/missoes/actions";
import { duplicateTeacherResource } from "@/app/professor/materiais/actions";
import { duplicateTeacherAssessment } from "@/app/professor/avaliacoes/actions";

function statusTone(status?: string | null): "green" | "yellow" | "neutral" {
  if (status === "published") return "green";
  if (status === "draft") return "yellow";
  return "neutral";
}

export default async function TeacherContentLibraryPage() {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return null;

  const [{ data: missions }, { data: materials }, { data: notebooks }, { data: assessments }] = await Promise.all([
    supabase.from("missions").select("id,title,objective,status,created_at,subjects(name),mission_students(student_id)").eq("created_by_teacher_id", teacher.id).order("created_at", { ascending: false }).limit(60),
    supabase.from("materials").select("id,title,description,status,created_at,subjects(name),material_assignments(student_id)").eq("created_by_teacher_id", teacher.id).order("created_at", { ascending: false }).limit(60),
    supabase.from("notebook_activities").select("id,title,description,status,created_at,subjects(name),notebook_assignments(student_id)").eq("created_by_teacher_id", teacher.id).order("created_at", { ascending: false }).limit(60),
    supabase.from("assessments").select("id,title,instructions,status,created_at,subjects(name),assessment_students(student_id)").eq("created_by_teacher_id", teacher.id).order("created_at", { ascending: false }).limit(60),
  ]);

  const items = [
    ...(missions ?? []).map((item: any) => ({ ...item, kind: "mission", type: "Missão", description: item.objective, count: item.mission_students?.length || 0, href: `/professor/missoes#missao-${item.id}` })),
    ...(materials ?? []).map((item: any) => ({ ...item, kind: "material", type: "Material", count: item.material_assignments?.length || 0, href: `/professor/materiais#material-${item.id}` })),
    ...(notebooks ?? []).map((item: any) => ({ ...item, kind: "notebook", type: "Caderno Curió", count: item.notebook_assignments?.length || 0, href: `/professor/materiais#notebook-${item.id}` })),
    ...(assessments ?? []).map((item: any) => ({ ...item, kind: "assessment", type: "Avaliação", description: item.instructions, count: item.assessment_students?.length || 0, href: `/professor/avaliacoes#avaliacao-${item.id}` })),
  ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <>
      <PageHeader
        eyebrow="Professor • Criar e publicar"
        title="Conteúdos"
        description="Sua biblioteca para reutilizar Missões, Cadernos, materiais e avaliações sem começar do zero."
      />
      <div className="teacher-library-filter"><span>{items.length} itens</span><span>{missions?.length ?? 0} Missões</span><span>{notebooks?.length ?? 0} Cadernos</span><span>{materials?.length ?? 0} materiais</span><span>{assessments?.length ?? 0} avaliações</span></div>

      <section className="panel">
        {items.length ? <div className="teacher-resource-list">{items.map((item: any) => (
          <article className="teacher-resource-card" key={`${item.kind}-${item.id}`}>
            <div className="teacher-resource-top">
              <div><div className="flex gap-8 wrap"><Badge tone="blue">{item.type}</Badge><Badge tone={statusTone(item.status)}>{item.status === "published" ? "Publicado" : item.status === "draft" ? "Rascunho" : "Arquivado"}</Badge>{item.subjects?.name && <Badge tone="purple">{item.subjects.name}</Badge>}</div><h3>{item.title}</h3><p>{item.description || "Sem descrição."}</p></div>
              <a className="button button-secondary button-small" href={item.href}>Abrir / enviar →</a>
            </div>
            <div className="teacher-resource-meta"><span>{item.count} aluno(s) vinculado(s)</span></div>
            <div className="teacher-resource-actions">
              {item.kind === "mission" && <form action={duplicateMission}><input type="hidden" name="missionId" value={item.id}/><button className="button button-secondary button-small" type="submit">Duplicar</button></form>}
              {(item.kind === "material" || item.kind === "notebook") && <form action={duplicateTeacherResource}><input type="hidden" name="kind" value={item.kind}/><input type="hidden" name="id" value={item.id}/><button className="button button-secondary button-small" type="submit">Duplicar</button></form>}
              {item.kind === "assessment" && <form action={duplicateTeacherAssessment}><input type="hidden" name="assessmentId" value={item.id}/><button className="button button-secondary button-small" type="submit">Duplicar</button></form>}
            </div>
          </article>
        ))}</div> : <EmptyState title="Biblioteca vazia" description="O que você criar em Missões, Materiais ou Avaliações aparecerá aqui para reutilização." />}
      </section>
    </>
  );
}
