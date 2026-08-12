import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { MultiStudentPicker } from "@/components/multi-student-picker";
import { getCurrentTeacher } from "@/lib/teacher";
import { createTeacherAssessment } from "../actions";

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
        description="Informe a avaliação uma vez e selecione todos os alunos que devem recebê-la."
        action={<Link className="button button-secondary" href="/professor/avaliacoes">Voltar às avaliações</Link>}
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}

      <section className="panel">
        <form action={createTeacherAssessment} className="form-stack">
          <div className="field"><label>Título *</label><input className="input" name="title" required /></div>
          <div className="field"><label>Alunos *</label><MultiStudentPicker students={students} /></div>
          <div className="form-row">
            <div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue=""><option value="">Geral</option>{(subjects ?? []).map((subject: any) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
            <div className="field"><label>Ano</label><select className="select" name="gradeId" defaultValue=""><option value="">Não definido</option>{(grades ?? []).map((grade: any) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
          </div>
          <div className="field"><label>Data e horário *</label><input className="input" type="datetime-local" name="scheduledFor" required /></div>
          <div className="field"><label>Conteúdo / observação</label><textarea className="textarea" name="instructions" /></div>
          <div className="field"><label>Critério de nota</label><select className="select" name="gradingSchemeId" defaultValue=""><option value="">Sem escala específica</option>{(gradingSchemes ?? []).map((scheme: any) => <option key={scheme.id} value={scheme.id}>{scheme.name} · {scheme.scale_min} a {scheme.scale_max}</option>)}</select></div>
          <div className="field"><label>Arquivo <span className="field-optional">opcional</span></label><input className="input" type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" /></div>
          <div className="flex gap-8 wrap">
            <button className="button button-primary" type="submit">Criar avaliação</button>
            <Link className="button button-ghost" href="/professor/avaliacoes">Cancelar</Link>
          </div>
        </form>
      </section>
    </>
  );
}
