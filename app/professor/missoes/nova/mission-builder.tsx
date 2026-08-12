"use client";

import { useState } from "react";
import { MultiStudentPicker } from "@/components/multi-student-picker";
import { createMissionWithQuestions } from "./actions";

type Option = { id: string; name: string };
type Student = { id: string; name: string; detail?: string };
type QuestionType = "multiple_choice" | "true_false" | "open_text";
type InitialQuestion = { type: QuestionType; prompt?: string; hint?: string; options?: string[]; correctValue?: string | null };
type QuestionState = { id: number; type: QuestionType; initial?: InitialQuestion };
type InitialDraft = { title?: string; objective?: string; description?: string; subjectId?: string; gradeId?: string; estimatedMinutes?: number; questions?: InitialQuestion[] };

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
  const initialQuestions: QuestionState[] = prepared.length ? prepared.map((question, index) => ({ id: index + 1, type: question.type, initial: question })) : [{ id: 1, type: "multiple_choice" }];
  const [questions, setQuestions] = useState<QuestionState[]>(initialQuestions);
  const [nextId, setNextId] = useState(initialQuestions.length + 1);
  function addQuestion() { if (questions.length < 20) { setQuestions((current) => [...current, { id: nextId, type: "multiple_choice" }]); setNextId((value) => value + 1); } }
  function removeQuestion(id: number) { if (questions.length > 1) setQuestions((current) => current.filter((question) => question.id !== id)); }
  function setType(id: number, type: QuestionType) { setQuestions((current) => current.map((question) => question.id === id ? { ...question, type } : question)); }

  return <form action={createMissionWithQuestions} className="form-stack">
    <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    <input type="hidden" name="questionCount" value={questions.length} />
    {sourceDraftId ? <><input type="hidden" name="sourceDraftId" value={sourceDraftId} /><input type="hidden" name="sourceOutputType" value={sourceOutputType} /></> : null}
    <section className="panel">
      <div className="panel-head"><div><h2>Informações da {sourceOutputType === "quiz" ? "quiz" : "missão"}</h2><p>Defina o contexto uma vez; depois revise as questões.</p></div></div>
      {initialDraft ? <div className="notice mb-16"><strong>Rascunho carregado.</strong> Revise todos os campos antes de criar. Nada foi publicado automaticamente.</div> : null}
      <div className="form-stack">
        <div className="field"><label>Título *</label><input className="input" name="title" defaultValue={initialDraft?.title || ""} required /></div>
        <div className="form-row"><div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue={initialDraft?.subjectId || ""}><option value="">Não definida</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div><div className="field"><label>Ano</label><select className="select" name="gradeId" defaultValue={initialDraft?.gradeId || ""}><option value="">Não definido</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div></div>
        <div className="field"><label>Mascote</label><select className="select" name="characterId" defaultValue=""><option value="">Sem mascote específico</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></div>
        <div className="field"><label>Objetivo *</label><textarea className="textarea" name="objective" defaultValue={initialDraft?.objective || ""} required /></div>
        <div className="field"><label>Descrição / orientação</label><textarea className="textarea textarea-compact" name="description" defaultValue={initialDraft?.description || ""} /></div>
        <div className="form-row"><div className="field"><label>Duração estimada</label><input className="input" type="number" name="estimatedMinutes" min="5" max="180" defaultValue={initialDraft?.estimatedMinutes || 20} required /></div><div className="field"><label>Prazo</label><input className="input" type="date" name="dueAt" /></div></div>
        <div className="field"><label>Habilidade principal *</label><select className="select" name="skillId" defaultValue="" required><option value="" disabled>Selecione</option>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></div>
        <div className="field"><label>Alunos</label><MultiStudentPicker students={students} /></div>
      </div>
    </section>
    <section className="panel">
      <div className="panel-head"><div><h2>Questões</h2><p>Múltipla escolha, verdadeiro ou falso e discursivas usam o motor já existente.</p></div></div>
      <div className="mission-builder-toolbar"><span className="mission-builder-counter">{questions.length} de 20 questões</span><button className="button button-secondary button-small" type="button" onClick={addQuestion} disabled={questions.length >= 20}>+ Adicionar questão</button></div>
      <div className="mission-builder-list mt-12">{questions.map((question, index) => { const initial = question.initial; const optionValues = initial?.options || []; return <article className="mission-builder-question" key={question.id}>
        <div className="mission-builder-question-head"><strong>Questão {index + 1}</strong>{questions.length > 1 && <button className="button button-ghost button-small" type="button" onClick={() => removeQuestion(question.id)}>Remover</button>}</div>
        <div className="field"><label>Enunciado *</label><textarea className="textarea" name={`q${index}Prompt`} defaultValue={initial?.prompt || ""} required /></div>
        <div className="field"><label>Tipo</label><select className="select" name={`q${index}Type`} value={question.type} onChange={(event) => setType(question.id, event.target.value as QuestionType)}><option value="multiple_choice">Múltipla escolha</option><option value="true_false">Verdadeiro ou falso</option><option value="open_text">Discursiva</option></select></div>
        {question.type === "multiple_choice" && <><div className="mission-option-builder">{(["A", "B", "C", "D"] as const).map((letter, optionIndex) => <div className="mission-option-row" key={letter}><label>{letter}</label><input className="input" name={`q${index}Option${letter}`} defaultValue={optionValues[optionIndex] || ""} required /></div>)}</div><div className="field"><label>Resposta correta *</label><div className="mission-answer-grid">{(["A", "B", "C", "D"] as const).map((letter, optionIndex) => <label className="mission-answer-choice" key={letter}><input type="radio" name={`q${index}CorrectOption`} value={letter} defaultChecked={Boolean(initial?.correctValue && optionValues[optionIndex] === initial.correctValue)} required /> Alternativa {letter}</label>)}</div></div></>}
        {question.type === "true_false" && <div className="field"><label>Resposta correta *</label><div className="mission-answer-grid"><label className="mission-answer-choice"><input type="radio" name={`q${index}CorrectOption`} value="Verdadeiro" defaultChecked={initial?.correctValue === "Verdadeiro"} required /> Verdadeiro</label><label className="mission-answer-choice"><input type="radio" name={`q${index}CorrectOption`} value="Falso" defaultChecked={initial?.correctValue === "Falso"} required /> Falso</label></div></div>}
        {question.type === "open_text" && <div className="notice">Questão discursiva: segue para Correções e não recebe gabarito automático.</div>}
        <div className="field"><label>Pista</label><input className="input" name={`q${index}Hint`} defaultValue={initial?.hint || ""} /></div>
      </article>; })}</div>
      <div className="flex gap-8 wrap mt-16"><button className="button button-secondary" type="button" onClick={addQuestion} disabled={questions.length >= 20}>+ Adicionar outra questão</button><button className="button button-primary" type="submit">Criar {sourceOutputType === "quiz" ? "quiz" : "missão"}</button></div>
    </section>
  </form>;
}
