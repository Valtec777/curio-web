import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { MultiStudentPicker } from "@/components/multi-student-picker";
import { getCurrentTeacher } from "@/lib/teacher";
import { removeTeacherResource, setTeacherResourceStatus, updateTeacherResource } from "@/app/professor/manage-actions";
import { assignTeacherResource, duplicateTeacherResource } from "./actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function statusLabel(status?: string | null, publishAt?: string | null) {
  if (status === "archived") return "Arquivado";
  if (status === "draft") return "Rascunho";
  if (publishAt && new Date(publishAt) > new Date()) return "Programado";
  return "Publicado";
}

export default async function TeacherMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return null;

  const [{ data: materials }, { data: notebooks }, { data: studentLinks }] = await Promise.all([
    supabase
      .from("materials")
      .select("id,title,description,material_type,file_path,status,publish_at,created_at,subjects(name),grades(name),material_assignments(student_id,due_at,status,students(preferred_name,full_name))")
      .eq("created_by_teacher_id", teacher.id)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("notebook_activities")
      .select("id,title,description,worksheet_path,status,publish_at,created_at,subjects(name),grades(name),notebook_assignments(student_id,due_at,status,students(preferred_name,full_name))")
      .eq("created_by_teacher_id", teacher.id)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("teacher_students")
      .select("student_id,students(preferred_name,full_name,school_name,grades(name))")
      .eq("teacher_id", teacher.id)
      .eq("active", true),
  ]);

  const students = (studentLinks ?? []).filter((link: any) => link.students).map((link: any) => ({
    id: link.student_id,
    name: link.students.preferred_name || link.students.full_name || "Aluno",
    detail: link.students.grades?.name || link.students.school_name || "",
  }));

  const fileItems = [
    ...(materials ?? []).filter((item: any) => item.file_path).map((item: any) => ({ key: `material-${item.id}`, path: item.file_path })),
    ...(notebooks ?? []).filter((item: any) => item.worksheet_path).map((item: any) => ({ key: `notebook-${item.id}`, path: item.worksheet_path })),
  ];
  const signedEntries = await Promise.all(fileItems.map(async (item) => {
    const { data } = await supabase.storage.from("teacher-materials").createSignedUrl(item.path, 60 * 30);
    return [item.key, data?.signedUrl || ""] as const;
  }));
  const signedUrls = new Map(signedEntries);

  const resources = [
    ...(materials ?? []).map((item: any) => ({ ...item, kind: "material" as const, assignments: item.material_assignments || [], filePath: item.file_path, typeLabel: item.material_type === "pdf" ? "PDF" : "Material" })),
    ...(notebooks ?? []).map((item: any) => ({ ...item, kind: "notebook" as const, assignments: item.notebook_assignments || [], filePath: item.worksheet_path, typeLabel: "Caderno Curió" })),
  ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <>
      <PageHeader
        eyebrow="Professor • Criar e publicar"
        title="Materiais"
        description="Publique materiais e Cadernos Curió para os alunos selecionados, com prazo e horário de liberação."
        action={<Link className="button button-primary" href="/professor/materiais/novo">+ Novo material</Link>}
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="panel">
        <div className="panel-head"><div><h2>Biblioteca publicada por você</h2><p>O arquivo completo abre em uma visualização segura. Itens programados só aparecem para o aluno quando chega o horário.</p></div></div>
        {resources.length ? (
          <div className="teacher-resource-list">
            {resources.map((item: any) => {
              const assignedIds = item.assignments.map((assignment: any) => assignment.student_id);
              const names = item.assignments.map((assignment: any) => assignment.students?.preferred_name || assignment.students?.full_name).filter(Boolean);
              const deadlines = item.assignments.map((assignment: any) => assignment.due_at).filter(Boolean).sort();
              const fileUrl = signedUrls.get(`${item.kind}-${item.id}`) || "";
              return (
                <article className="teacher-resource-card" id={`${item.kind}-${item.id}`} key={`${item.kind}-${item.id}`}>
                  <div className="teacher-resource-top">
                    <div>
                      <div className="flex gap-8 wrap">
                        <Badge tone={item.kind === "notebook" ? "pink" : "blue"}>{item.typeLabel}</Badge>
                        <Badge tone={item.status === "published" ? "green" : item.status === "archived" ? "neutral" : "yellow"}>{statusLabel(item.status, item.publish_at)}</Badge>
                        {item.subjects?.name && <Badge tone="blue">{item.subjects.name}</Badge>}
                        {item.grades?.name && <Badge tone="purple">{item.grades.name}</Badge>}
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                    {fileUrl && <a className="button button-secondary button-small" href={fileUrl} target="_blank" rel="noreferrer">Abrir arquivo ↗</a>}
                  </div>

                  <div className="teacher-resource-meta">
                    {item.publish_at && <span>Liberação: {dt(item.publish_at)}</span>}
                    {deadlines[0] && <span>• Prazo: {dt(deadlines[0])}</span>}
                    <span>• {item.assignments.length} aluno(s)</span>
                  </div>

                  {names.length > 0 && <div className="flex gap-8 wrap"><small className="muted">Para:</small>{names.map((name: string, index: number) => <Badge tone="blue" key={`${name}-${index}`}>{name}</Badge>)}</div>}

                  <details className="plan-editor">
                    <summary>Enviar para alunos</summary>
                    <form action={assignTeacherResource} className="form-stack compact-form">
                      <input type="hidden" name="kind" value={item.kind} />
                      <input type="hidden" name="id" value={item.id} />
                      <MultiStudentPicker students={students} defaultSelected={assignedIds} />
                      <div className="field"><label>Prazo</label><input className="input" type="date" name="dueAt" /></div>
                      <button className="button button-primary button-small" type="submit">Enviar aos selecionados</button>
                    </form>
                  </details>

                  <details className="plan-editor">
                    <summary>Editar</summary>
                    <form action={updateTeacherResource} className="form-stack compact-form">
                      <input type="hidden" name="kind" value={item.kind} />
                      <input type="hidden" name="id" value={item.id} />
                      <div className="field"><label>Título</label><input className="input" name="title" defaultValue={item.title} required /></div>
                      <div className="field"><label>Descrição / instrução</label><textarea className="textarea" name="description" defaultValue={item.description || ""} /></div>
                      <button className="button button-secondary button-small" type="submit">Salvar alterações</button>
                    </form>
                  </details>

                  <div className="teacher-resource-actions">
                    <form action={duplicateTeacherResource}><input type="hidden" name="kind" value={item.kind}/><input type="hidden" name="id" value={item.id}/><button className="button button-secondary button-small" type="submit">Duplicar</button></form>
                    {item.status !== "archived" && <form action={setTeacherResourceStatus}><input type="hidden" name="kind" value={item.kind}/><input type="hidden" name="id" value={item.id}/><input type="hidden" name="status" value="archived"/><button className="button button-ghost button-small" type="submit">Arquivar</button></form>}
                    <form action={removeTeacherResource}><input type="hidden" name="kind" value={item.kind}/><input type="hidden" name="id" value={item.id}/><button className="button button-danger button-small" type="submit">Excluir</button></form>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Nenhum material criado" description="Crie o primeiro material ou Caderno Curió pelo botão acima." />}
      </section>
    </>
  );
}
