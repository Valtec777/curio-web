import { randomUUID } from "node:crypto";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { MissionBuilder } from "./mission-builder";

export default async function NewMissionPage({ searchParams }: { searchParams: Promise<{ erro?: string; rascunho?: string }> }) {
  const query = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return null;

  const [{ data: subjects }, { data: grades }, { data: skills }, { data: characters }, { data: studentLinks }] = await Promise.all([
    supabase.from("subjects").select("id,name").eq("active", true).order("name"),
    supabase.from("grades").select("id,name,sort_order").eq("active", true).order("sort_order"),
    supabase.from("skills").select("id,name").eq("active", true).order("name").limit(180),
    supabase.from("characters").select("id,name").eq("active", true).order("sort_order"),
    supabase.from("teacher_students").select("student_id,students(preferred_name,full_name,school_name,deleted_at,grades(name))").eq("teacher_id", teacher.id).eq("active", true),
  ]);

  let initialDraft: any = null;
  if (query.rascunho) {
    const { data: draft } = await supabase.from("content_preparation_drafts").select("id,title,objective,notes,subject_id,grade_id,estimated_minutes").eq("id", query.rascunho).eq("created_by_teacher_id", teacher.id).maybeSingle();
    if (draft) {
      const { data: questions } = await supabase.from("content_preparation_questions").select("question_type,prompt,options,correct_value,hint,position").eq("draft_id", draft.id).order("position");
      initialDraft = {
        title: draft.title || "",
        objective: draft.objective || "",
        description: draft.notes || "",
        subjectId: draft.subject_id || "",
        gradeId: draft.grade_id || "",
        estimatedMinutes: draft.estimated_minutes || 20,
        questions: (questions ?? []).map((question: any) => ({
          type: question.question_type === "multiple_choice" || question.question_type === "true_false" ? question.question_type : "open_text",
          prompt: question.prompt || "",
          hint: question.hint || "",
          options: Array.isArray(question.options) ? question.options : [],
          correctValue: question.correct_value || null,
        })),
      };
    }
  }

  const students = (studentLinks ?? []).filter((link: any) => link.students && !link.students.deleted_at).map((link: any) => ({
    id: link.student_id,
    name: link.students.preferred_name || link.students.full_name || "Aluno",
    detail: link.students.grades?.name || link.students.school_name || "",
  }));

  const idempotencyKey = query.rascunho ? `content-draft:${query.rascunho}` : randomUUID();

  return <>
    <PageHeader eyebrow="Professor • Missões" title="Nova Missão Cuca" description="Monte a missão em uma página própria e adicione quantas questões precisar, até 20 por missão." action={<Link className="button button-secondary" href="/professor/missoes">Voltar às missões</Link>} />
    {query.erro && <div className="form-message form-error">{query.erro}</div>}
    <MissionBuilder
      idempotencyKey={idempotencyKey}
      subjects={(subjects ?? []).map((item: any) => ({ id: item.id, name: item.name }))}
      grades={(grades ?? []).map((item: any) => ({ id: item.id, name: item.name }))}
      skills={(skills ?? []).map((item: any) => ({ id: item.id, name: item.name }))}
      characters={(characters ?? []).map((item: any) => ({ id: item.id, name: item.name }))}
      students={students}
      initialDraft={initialDraft}
    />
  </>;
}
