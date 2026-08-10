import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { MultiStudentPicker } from "@/components/multi-student-picker";
import { getCurrentTeacher } from "@/lib/teacher";
import { createTeacherMaterial } from "../actions";

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
        title={kind === "notebook" ? "Nova atividade / Caderno Curió" : "Novo material de apoio"}
        description={kind === "notebook" ? "Publique um treino em PDF ou imagem para os alunos selecionados." : "Publique um conteúdo de apoio para leitura, consulta ou estudo."}
        action={<Link className="button button-secondary" href="/professor/materiais">Voltar aos materiais</Link>}
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}

      <section className="panel">
        <div className="teacher-source-tabs">
          <Link className={`teacher-source-tab${kind === "notebook" ? " is-active" : ""}`} href="/professor/materiais/novo?tipo=notebook">Atividade / Caderno</Link>
          <Link className={`teacher-source-tab${kind === "material" ? " is-active" : ""}`} href="/professor/materiais/novo?tipo=material">Material de apoio</Link>
        </div>

        <form action={createTeacherMaterial} className="form-stack">
          <input type="hidden" name="kind" value={kind} />
          <div className="field"><label>Título *</label><input className="input" name="title" required /></div>
          <div className="field"><label>Descrição / instrução *</label><textarea className="textarea" name="description" required /></div>
          <div className="form-row">
            <div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue=""><option value="">Geral</option>{(subjects ?? []).map((subject: any) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
            <div className="field"><label>Ano</label><select className="select" name="gradeId" defaultValue=""><option value="">Geral</option>{(grades ?? []).map((grade: any) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
          </div>
          <div className="field"><label>Categoria</label><select className="select" name="category" defaultValue="pdf"><option value="pdf">PDF</option><option value="image">Imagem</option><option value="file">Arquivo</option><option value="other">Outro</option></select></div>
          <div className="field"><label>PDF ou imagem *</label><input className="input" type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" required /></div>
          <div className="field"><label>Alunos</label><MultiStudentPicker students={students} /></div>
          <div className="form-row">
            <div className="field"><label>Prazo</label><input className="input" type="date" name="dueAt" /></div>
            <div className="field"><label>Publicação</label><select className="select" name="publishMode" defaultValue="now"><option value="now">Publicar agora</option><option value="later">Publicar em dia e horário</option><option value="draft">Salvar como rascunho</option></select></div>
          </div>
          <div className="field"><label>Dia e horário da publicação programada</label><input className="input" type="datetime-local" name="publishAt" /></div>
          <div className="flex gap-8 wrap">
            <button className="button button-primary" type="submit">Salvar {kind === "notebook" ? "atividade" : "material"}</button>
            <Link className="button button-ghost" href="/professor/materiais">Cancelar</Link>
          </div>
        </form>
      </section>
    </>
  );
}
