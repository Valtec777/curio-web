"use client";

import { useState } from "react";
import { MultiStudentPicker } from "@/components/multi-student-picker";
import { PdfTemplateImporter } from "@/components/pdf-template-importer";
import { createTeacherMaterial } from "../actions";

type Option = { id: string; name: string };
type Student = { id: string; name: string; detail?: string };

type SourceFile = {
  path: string;
  name: string;
  mimeType: string;
  size: number;
} | null;

export function MaterialBuilder({ subjects, grades, students, initialKind }: {
  subjects: Option[];
  grades: Option[];
  students: Student[];
  initialKind: "notebook" | "material";
}) {
  const [kind, setKind] = useState<"notebook" | "material">(initialKind);
  const [sourceFile, setSourceFile] = useState<SourceFile>(null);
  const [values, setValues] = useState({
    title: "",
    description: "",
    subjectId: "",
    gradeId: "",
    category: "pdf",
    dueAt: "",
    publishMode: "now",
    publishAt: "",
  });

  function setField(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function applyImported(data: any) {
    if (data?.target !== "material") return;
    setKind(data.kind === "material" ? "material" : "notebook");
    setValues({
      title: data.title || "",
      description: data.description || "",
      subjectId: data.subjectId || "",
      gradeId: data.gradeId || "",
      category: data.category || "pdf",
      dueAt: data.dueAt || "",
      publishMode: data.publishMode || "now",
      publishAt: data.publishAt || "",
    });
    setSourceFile(data.sourceFilePath ? {
      path: data.sourceFilePath,
      name: data.sourceFileName || "material.pdf",
      mimeType: data.sourceMimeType || "application/pdf",
      size: Number(data.sourceFileSize || 0),
    } : null);
  }

  const canReuseImportedPdf = Boolean(sourceFile && values.category === "pdf");

  return <>
    <PdfTemplateImporter target="material" templateHref="/modelos/professor/material" onImported={applyImported} />

    <section className="panel">
      <div className="teacher-source-tabs">
        <button className={`teacher-source-tab${kind === "notebook" ? " is-active" : ""}`} type="button" onClick={() => setKind("notebook")}>Atividade / Caderno</button>
        <button className={`teacher-source-tab${kind === "material" ? " is-active" : ""}`} type="button" onClick={() => setKind("material")}>Material de apoio</button>
      </div>

      <form action={createTeacherMaterial} className="form-stack">
        <input type="hidden" name="kind" value={kind} />
        {sourceFile ? <>
          <input type="hidden" name="preparedFilePath" value={sourceFile.path} />
          <input type="hidden" name="preparedFileName" value={sourceFile.name} />
          <input type="hidden" name="preparedFileMimeType" value={sourceFile.mimeType} />
          <input type="hidden" name="preparedFileSize" value={String(sourceFile.size)} />
        </> : null}

        <div className="field"><label>Título *</label><input className="input" name="title" value={values.title} onChange={(event) => setField("title", event.target.value)} required /></div>
        <div className="field"><label>Descrição / instrução *</label><textarea className="textarea" name="description" value={values.description} onChange={(event) => setField("description", event.target.value)} required /></div>
        <div className="form-row">
          <div className="field"><label>Matéria</label><select className="select" name="subjectId" value={values.subjectId} onChange={(event) => setField("subjectId", event.target.value)}><option value="">Geral</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
          <div className="field"><label>Ano</label><select className="select" name="gradeId" value={values.gradeId} onChange={(event) => setField("gradeId", event.target.value)}><option value="">Geral</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
        </div>
        <div className="field"><label>Categoria</label><select className="select" name="category" value={values.category} onChange={(event) => setField("category", event.target.value)}><option value="pdf">PDF</option><option value="image">Imagem</option><option value="file">Arquivo</option><option value="other">Outro</option></select></div>

        {canReuseImportedPdf ? <div className="notice"><strong>PDF pronto para uso:</strong> {sourceFile?.name}. Se você não anexar outro arquivo abaixo, este mesmo PDF importado será publicado para os alunos.</div> : sourceFile ? <div className="notice">O PDF importado preencheu os campos, mas a categoria escolhida é {values.category}. Anexe abaixo o arquivo final correspondente.</div> : null}

        <div className="field"><label>PDF ou imagem {canReuseImportedPdf ? <span className="field-optional">opcional - já importado</span> : "*"}</label><input className="input" type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" required={!canReuseImportedPdf} /></div>
        <div className="field"><label>Alunos</label><MultiStudentPicker students={students} /></div>
        <div className="form-row">
          <div className="field"><label>Prazo</label><input className="input" type="date" name="dueAt" value={values.dueAt} onChange={(event) => setField("dueAt", event.target.value)} /></div>
          <div className="field"><label>Publicação</label><select className="select" name="publishMode" value={values.publishMode} onChange={(event) => setField("publishMode", event.target.value)}><option value="now">Publicar agora</option><option value="later">Publicar em dia e horário</option><option value="draft">Salvar como rascunho</option></select></div>
        </div>
        <div className="field"><label>Dia e horário da publicação programada</label><input className="input" type="datetime-local" name="publishAt" value={values.publishAt} onChange={(event) => setField("publishAt", event.target.value)} required={values.publishMode === "later"} /></div>
        <div className="flex gap-8 wrap">
          <button className="button button-primary" type="submit">Salvar {kind === "notebook" ? "atividade" : "material"}</button>
          <a className="button button-ghost" href="/professor/materiais">Cancelar</a>
        </div>
      </form>
    </section>
  </>;
}
