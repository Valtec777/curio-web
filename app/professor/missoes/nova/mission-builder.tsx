"use client";

import { useState } from "react";
import { MultiStudentPicker } from "@/components/multi-student-picker";
import { PdfTemplateImporter } from "@/components/pdf-template-importer";
import { createMissionWithQuestions } from "./actions";

type Option = { id: string; name: string };
type Student = { id: string; name: string; detail?: string };
type QuestionType = "multiple_choice" | "true_false" | "open_text";
type InitialQuestion = { type: QuestionType; prompt?: string; hint?: string; options?: string[]; correctValue?: string | null };
type QuestionState = { id: number; type: QuestionType; prompt: string; hint: string; options: string[]; correctValue: string };
type InitialDraft = { title?: string; objective?: string; description?: string; subjectId?: string; gradeId?: string; characterId?: string; skillId?: string; dueAt?: string; estimatedMinutes?: number; questions?: InitialQuestion[] };

function makeQuestion(id: number, initial?: InitialQuestion): QuestionState {
  return {
    id,
    type: initial?.type || "multiple_choice",
    prompt: initial?.prompt || "",
    hint: initial?.hint || "",
    options: initial?.options?.slice(0, 4) || [],
    correctValue: initial?.correctValue || "",
  };
}

export function MissionBuilder({ idempotencyKey, subjects, grades, skills, characters, students, initialDraft, sourceDraftId, sourceOutputType = "mission" }: {
  idempotencyKey: string;
  subjects: Option[];
  grades: Option[];
  skills: Option[];
  characters: Option[];
  students: Student[];
  initialDraft?: InitialDraft | null;
  sourceDraftId?: string | null;
  sourceOutputType?: "mission" | "quiz";
}) {
  const prepared = (initialDraft?.questions || []).slice(0, 20);
  const initialQuestions = prepared.length ? prepared.map((question, index) => makeQuestion(index + 1, question)) : [makeQuestion(1)];
  const [questions, setQuestions] = useState<QuestionState[]>(initialQuestions);
  const [nextId, setNextId] = useState(initialQuestions.length + 1);
  const [importNotice, setImportNotice] = useState("");
  const [values, setValues] = useState({
    title: initialDraft?.title || "",
    subjectId: initialDraft?.subjectId || "",
    gradeId: initialDraft?.gradeId || "",
    characterId: initialDraft?.characterId || "",
    objective: initialDraft?.objective || "",
    description: initialDraft?.description || "",
    estimatedMinutes: String(initialDraft?.estimatedMinutes || 20),
    dueAt: initialDraft?.dueAt || "",
    skillId: initialDraft?.skillId || "",
  });

  function setField(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function addQuestion() {
    if (questions.length < 20) {
      setQuestions((current) => [...current, makeQuestion(nextId)]);
      setNextId((value) => value + 1);
    }
  }

  function removeQuestion(id: number) {
    if (questions.length > 1) setQuestions((current) => current.filter((question) => question.id !== id));
  }

  function patchQuestion(id: number, patch: Partial<QuestionState>) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question));
  }

  function setType(id: number, type: QuestionType) {
    setQuestions((current) => current.map((question) => question.id === id
      ? { ...question, type, options: type === "true_false" ? ["Verdadeiro", "Falso"] : type === "open_text" ? [] : question.options, correctValue: "" }
      : question));
  }

  function setOption(id: number, optionIndex: number, value: string) {
    setQuestions((current) => current.map((question) => {
      if (question.id !== id) return question;
      const oldValue = question.options[optionIndex] || "";
      const options = [...question.options];
      options[optionIndex] = value;
      return { ...question, options, correctValue: question.correctValue === oldValue ? value : question.correctValue };
    }));
  }

  function applyImported(data: any) {
    if (data?.target !== "mission") return;
    setValues({
      title: data.title || "",
      subjectId: data.subjectId || "",
      gradeId: data.gradeId || "",
      characterId: data.characterId || "",
      objective: data.objective || "",
      description: data.description || "",
      estimatedMinutes: String(data.estimatedMinutes || 20),
      dueAt: data.dueAt || "",
      skillId: data.skillId || "",
    });
    const importedQuestions = Array.isArray(data.questions) && data.questions.length
      ? data.questions.slice(0, 20).map((question: InitialQuestion, index: number) => makeQuestion(index + 1, question))
      : [makeQuestion(1)];
    setQuestions(importedQuestions);
    setNextId(importedQuestions.length + 1);
    setImportNotice(data.skillName && !data.skillId ? `O PDF indicou a habilidade “${data.skillName}”, mas ela não coincidiu exatamente com o cadastro. Selecione a habilidade mais adequada antes de salvar.` : "PDF importado. Revise tudo antes de criar a missão.");
  }

  return <form action={createMissionWithQuestions} className="form-stack">
    <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    <input type="hidden" name="questionCount" value={questions.length} />
    {sourceDraftId ? <><input type="hidden" name="sourceDraftId" value={sourceDraftId} /><input type="hidden" name="sourceOutputType" value={sourceOutputType} /></> : null}

    <PdfTemplateImporter target="mission" templateHref="/modelos/professor/missao" onImported={applyImported} />
    {importNotice ? <div className="notice">{importNotice}</div> : null}

    <section className="panel">
      <div className="panel-head"><div><h2>Informações da {sourceOutputType === "quiz" ? "quiz" : "missão"}</h2><p>Defina o contexto uma vez; depois revise as questões.</p></div></div>
      {initialDraft ? <div className="notice mb-16"><strong>Rascunho carregado.</strong> Revise todos os campos antes de criar. Nada foi publicado automaticamente.</div> : null}
      <div className="form-stack">
        <div className="field"><label>Título *</label><input className="input" name="title" value={values.title} onChange={(event) => setField("title", event.target.value)} required /></div>
        <div className="form-row"><div className="field"><label>Matéria</label><select className="select" name="subjectId" value={values.subjectId} onChange={(event) => setField("subjectId", event.target.value)}><option value="">Não definida</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div><div className="field"><label>Ano</label><select className="select" name="gradeId" value={values.gradeId} onChange={(event) => setField("gradeId", event.target.value)}><option value="">Não definido</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div></div>
        <div className="field"><label>Mascote</label><select className="select" name="characterId" value={values.characterId} onChange={(event) => setField("characterId", event.target.value)}><option value="">Sem mascote específico</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></div>
        <div className="field"><label>Objetivo *</label><textarea className="textarea" name="objective" value={values.objective} onChange={(event) => setField("objective", event.target.value)} required /></div>
        <div className="field"><label>Descrição / orientação</label><textarea className="textarea textarea-compact" name="description" value={values.description} onChange={(event) => setField("description", event.target.value)} /></div>
        <div className="form-row"><div className="field"><label>Duração estimada</label><input className="input" type="number" name="estimatedMinutes" min="5" max="180" value={values.estimatedMinutes} onChange={(event) => setField("estimatedMinutes", event.target.value)} required /></div><div className="field"><label>Prazo</label><input className="input" type="date" name="dueAt" value={values.dueAt} onChange={(event) => setField("dueAt", event.target.value)} /></div></div>
        <div className="field"><label>Habilidade principal *</label><select className="select" name="skillId" value={values.skillId} onChange={(event) => setField("skillId", event.target.value)} required><option value="" disabled>Selecione</option>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></div>
        <div className="field"><label>Alunos</label><MultiStudentPicker students={students} /></div>
      </div>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Questões</h2><p>O PDF pode preencher tudo; você continua podendo editar, adicionar ou remover questões antes de salvar.</p></div></div>
      <div className="mission-builder-toolbar"><span className="mission-builder-counter">{questions.length} de 20 questões</span><button className="button button-secondary button-small" type="button" onClick={addQuestion} disabled={questions.length >= 20}>+ Adicionar questão</button></div>
      <div className="mission-builder-list mt-12">{questions.map((question, index) => {
        const optionValues = question.options;
        return <article className="mission-builder-question" key={question.id}>
          <div className="mission-builder-question-head"><strong>Questão {index + 1}</strong>{questions.length > 1 && <button className="button button-ghost button-small" type="button" onClick={() => removeQuestion(question.id)}>Remover</button>}</div>
          <div className="field"><label>Enunciado *</label><textarea className="textarea" name={`q${index}Prompt`} value={question.prompt} onChange={(event) => patchQuestion(question.id, { prompt: event.target.value })} required /></div>
          <div className="field"><label>Tipo</label><select className="select" name={`q${index}Type`} value={question.type} onChange={(event) => setType(question.id, event.target.value as QuestionType)}><option value="multiple_choice">Múltipla escolha</option><option value="true_false">Verdadeiro ou falso</option><option value="open_text">Discursiva</option></select></div>
          {question.type === "multiple_choice" && <><div className="mission-option-builder">{(["A", "B", "C", "D"] as const).map((letter, optionIndex) => <div className="mission-option-row" key={letter}><label>{letter}</label><input className="input" name={`q${index}Option${letter}`} value={optionValues[optionIndex] || ""} onChange={(event) => setOption(question.id, optionIndex, event.target.value)} required /></div>)}</div><div className="field"><label>Resposta correta *</label><div className="mission-answer-grid">{(["A", "B", "C", "D"] as const).map((letter, optionIndex) => <label className="mission-answer-choice" key={letter}><input type="radio" name={`q${index}CorrectOption`} value={letter} checked={Boolean(optionValues[optionIndex] && optionValues[optionIndex] === question.correctValue)} onChange={() => patchQuestion(question.id, { correctValue: optionValues[optionIndex] || "" })} required /> Alternativa {letter}</label>)}</div></div></>}
          {question.type === "true_false" && <div className="field"><label>Resposta correta *</label><div className="mission-answer-grid"><label className="mission-answer-choice"><input type="radio" name={`q${index}CorrectOption`} value="Verdadeiro" checked={question.correctValue === "Verdadeiro"} onChange={() => patchQuestion(question.id, { correctValue: "Verdadeiro" })} required /> Verdadeiro</label><label className="mission-answer-choice"><input type="radio" name={`q${index}CorrectOption`} value="Falso" checked={question.correctValue === "Falso"} onChange={() => patchQuestion(question.id, { correctValue: "Falso" })} required /> Falso</label></div></div>}
          {question.type === "open_text" && <><div className="notice">Questão discursiva: segue para Correções e continua sendo avaliada pelo professor.</div><div className="field"><label>Resposta de referência <span className="field-optional">opcional</span></label><textarea className="textarea textarea-compact" name={`q${index}ReferenceAnswer`} value={question.correctValue} onChange={(event) => patchQuestion(question.id, { correctValue: event.target.value })} placeholder="Resposta esperada para apoiar a correção manual" /></div></>}
          <div className="field"><label>Pista</label><input className="input" name={`q${index}Hint`} value={question.hint} onChange={(event) => patchQuestion(question.id, { hint: event.target.value })} /></div>
        </article>;
      })}</div>
      <div className="flex gap-8 wrap mt-16"><button className="button button-secondary" type="button" onClick={addQuestion} disabled={questions.length >= 20}>+ Adicionar outra questão</button><button className="button button-primary" type="submit">Criar {sourceOutputType === "quiz" ? "quiz" : "missão"}</button></div>
    </section>
  </form>;
}
