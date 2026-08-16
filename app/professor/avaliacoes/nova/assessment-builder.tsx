"use client";

import { useState } from "react";
import { MultiStudentPicker } from "@/components/multi-student-picker";
import { PdfTemplateImporter } from "@/components/pdf-template-importer";
import { createTeacherAssessmentAssisted } from "./actions";

type Option = { id: string; name: string };
type Student = { id: string; name: string; detail?: string };
type GradingScheme = { id: string; name: string; scaleMin: number; scaleMax: number };
type SourceFile = { path: string; name: string; mimeType: string; size: number } | null;

export function AssessmentBuilder({ subjects, grades, students, gradingSchemes }: {
  subjects: Option[];
  grades: Option[];
  students: Student[];
  gradingSchemes: GradingScheme[];
}) {
  const [sourceFile, setSourceFile] = useState<SourceFile>(null);
  const [reusePreparedFile, setReusePreparedFile] = useState(true);
  const [values, setValues] = useState({
    title: "",
    subjectId: "",
    gradeId: "",
    scheduledFor: "",
    content: "",
    observation: "",
    gradingSchemeId: "",
  });

  function setField(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function applyImported(data: any) {
    if (data?.target !== "assessment") return;
    setValues({
      title: data.title || "",
      subjectId: data.subjectId || "",
      gradeId: data.gradeId || "",
      scheduledFor: data.scheduledFor || "",
      content: data.content || "",
      observation: data.observation || "",
      gradingSchemeId: data.gradingSchemeId || "",
    });
    setSourceFile(data.sourceFilePath ? {
      path: data.sourceFilePath,
      name: data.sourceFileName || "avaliacao.pdf",
      mimeType: data.sourceMimeType || "application/pdf",
      size: Number(data.sourceFileSize || 0),
    } : null);
    setReusePreparedFile(true);
  }

  const zeroToTen = gradingSchemes.find((scheme) => scheme.scaleMin === 0 && scheme.scaleMax === 10);

  return <>
    <PdfTemplateImporter target="assessment" templateHref="/modelos/professor/avaliacao" onImported={applyImported} />

    <section className="panel">
      <form action={createTeacherAssessmentAssisted} className="form-stack">
        {sourceFile ? <>
          <input type="hidden" name="preparedFilePath" value={sourceFile.path} />
          <input type="hidden" name="preparedFileName" value={sourceFile.name} />
          <input type="hidden" name="preparedFileMimeType" value={sourceFile.mimeType} />
          <input type="hidden" name="preparedFileSize" value={String(sourceFile.size)} />
        </> : null}

        <div className="field"><label>Título *</label><input className="input" name="title" value={values.title} onChange={(event) => setField("title", event.target.value)} required /></div>
        <div className="field"><label>Alunos *</label><MultiStudentPicker students={students} /></div>
        <div className="form-row">
          <div className="field"><label>Matéria</label><select className="select" name="subjectId" value={values.subjectId} onChange={(event) => setField("subjectId", event.target.value)}><option value="">Geral</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
          <div className="field"><label>Ano</label><select className="select" name="gradeId" value={values.gradeId} onChange={(event) => setField("gradeId", event.target.value)}><option value="">Não definido</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
        </div>
        <div className="field"><label>Data e horário *</label><input className="input" type="datetime-local" name="scheduledFor" value={values.scheduledFor} onChange={(event) => setField("scheduledFor", event.target.value)} required /></div>
        <div className="field"><label>Conteúdo</label><textarea className="textarea" name="content" value={values.content} onChange={(event) => setField("content", event.target.value)} placeholder="Conteúdos, unidades, capítulos ou habilidades cobradas" /></div>
        <div className="field"><label>Observação</label><textarea className="textarea textarea-compact" name="observation" value={values.observation} onChange={(event) => setField("observation", event.target.value)} placeholder="Orientações adicionais para aluno e família" /></div>
        <div className="field"><label>Critério de nota</label><select className="select" name="gradingSchemeId" value={values.gradingSchemeId} onChange={(event) => setField("gradingSchemeId", event.target.value)}><option value="">Sem escala específica</option>{zeroToTen ? <option value={zeroToTen.id}>Escala numérica 0 a 10</option> : gradingSchemes.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.name}</option>)}</select></div>

        {sourceFile ? <div className="notice"><strong>PDF importado:</strong> {sourceFile.name}. Você pode usá-lo como o anexo da avaliação ou desmarcar a opção abaixo e anexar outro arquivo.</div> : null}
        {sourceFile ? <label className="consent-line"><input type="checkbox" name="reusePreparedFile" checked={reusePreparedFile} onChange={(event) => setReusePreparedFile(event.target.checked)} /> Usar o PDF importado como arquivo da avaliação</label> : null}
        <div className="field"><label>Arquivo <span className="field-optional">opcional</span></label><input className="input" type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" /></div>

        <div className="flex gap-8 wrap">
          <button className="button button-primary" type="submit">Criar avaliação</button>
          <a className="button button-ghost" href="/professor/avaliacoes">Cancelar</a>
        </div>
      </form>
    </section>
  </>;
}
