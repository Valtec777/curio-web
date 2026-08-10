"use client";

import { useState } from "react";
import { MultiStudentPicker } from "@/components/multi-student-picker";
import { createMissionWithQuestions } from "./actions";

type Option = { id: string; name: string };
type Student = { id: string; name: string; detail?: string };
type QuestionType = "multiple_choice" | "true_false" | "open_text";
type QuestionState = { id: number; type: QuestionType };

export function MissionBuilder({
  idempotencyKey,
  subjects,
  grades,
  skills,
  characters,
  students,
}: {
  idempotencyKey: string;
  subjects: Option[];
  grades: Option[];
  skills: Option[];
  characters: Option[];
  students: Student[];
}) {
  const [questions, setQuestions] = useState<QuestionState[]>([{ id: 1, type: "multiple_choice" }]);
  const [nextId, setNextId] = useState(2);

  function addQuestion() {
    if (questions.length >= 20) return;
    setQuestions((current) => [...current, { id: nextId, type: "multiple_choice" }]);
    setNextId((value) => value + 1);
  }

  function removeQuestion(id: number) {
    if (questions.length === 1) return;
    setQuestions((current) => current.filter((question) => question.id !== id));
  }

  function setType(id: number, type: QuestionType) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, type } : question));
  }

  return (
    <form action={createMissionWithQuestions} className="form-stack">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="questionCount" value={questions.length} />

      <section className="panel">
        <div className="panel-head"><div><h2>Informações da missão</h2><p>Defina o contexto uma vez; depois adicione quantas questões precisar.</p></div></div>
        <div className="form-stack">
          <div className="field"><label>Título *</label><input className="input" name="title" required /></div>
          <div className="form-row">
            <div className="field"><label>Matéria</label><select className="select" name="subjectId" defaultValue=""><option value="">Não definida</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
            <div className="field"><label>Ano</label><select className="select" name="gradeId" defaultValue=""><option value="">Não definido</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
          </div>
          <div className="field"><label>Mascote</label><select className="select" name="characterId" defaultValue=""><option value="">Sem mascote específico</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></div>
          <div className="field"><label>Objetivo *</label><textarea className="textarea" name="objective" required /></div>
          <div className="field"><label>Descrição / orientação</label><textarea className="textarea textarea-compact" name="description" /></div>
          <div className="form-row">
            <div className="field"><label>Duração estimada</label><input className="input" type="number" name="estimatedMinutes" min="5" max="180" defaultValue="20" required /></div>
            <div className="field"><label>Prazo</label><input className="input" type="date" name="dueAt" /></div>
          </div>
          <div className="field"><label>Habilidade principal *</label><select className="select" name="skillId" defaultValue="" required><option value="" disabled>Selecione</option>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></div>
          <div className="field"><label>Alunos</label><MultiStudentPicker students={students} /></div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><h2>Questões</h2><p>Você pode misturar múltipla escolha, verdadeiro ou falso e discursivas na mesma Missão Cuca.</p></div>
        </div>

        <div className="mission-builder-toolbar">
          <span className="mission-builder-counter">{questions.length} de 20 questões</span>
          <button className="button button-secondary button-small" type="button" onClick={addQuestion} disabled={questions.length >= 20}>+ Adicionar questão</button>
        </div>

        <div className="mission-builder-list mt-12">
          {questions.map((question, index) => (
            <article className="mission-builder-question" key={question.id}>
              <div className="mission-builder-question-head">
                <strong>Questão {index + 1}</strong>
                {questions.length > 1 && <button className="button button-ghost button-small" type="button" onClick={() => removeQuestion(question.id)}>Remover</button>}
              </div>

              <div className="field"><label>Enunciado *</label><textarea className="textarea" name={`q${index}Prompt`} required /></div>
              <div className="field">
                <label>Tipo</label>
                <select className="select" name={`q${index}Type`} value={question.type} onChange={(event) => setType(question.id, event.target.value as QuestionType)}>
                  <option value="multiple_choice">Múltipla escolha</option>
                  <option value="true_false">Verdadeiro ou falso</option>
                  <option value="open_text">Discursiva</option>
                </select>
              </div>

              {question.type === "multiple_choice" && (
                <>
                  <div className="mission-option-builder">
                    {(["A", "B", "C", "D"] as const).map((letter) => (
                      <div className="mission-option-row" key={letter}>
                        <label>{letter}</label>
                        <input className="input" name={`q${index}Option${letter}`} placeholder={`Alternativa ${letter}`} required />
                      </div>
                    ))}
                  </div>
                  <div className="field">
                    <label>Resposta correta *</label>
                    <div className="mission-answer-grid">
                      {(["A", "B", "C", "D"] as const).map((letter) => <label className="mission-answer-choice" key={letter}><input type="radio" name={`q${index}CorrectOption`} value={letter} required /> Alternativa {letter}</label>)}
                    </div>
                  </div>
                </>
              )}

              {question.type === "true_false" && (
                <div className="field">
                  <label>Resposta correta *</label>
                  <div className="mission-answer-grid">
                    <label className="mission-answer-choice"><input type="radio" name={`q${index}CorrectOption`} value="Verdadeiro" required /> Verdadeiro</label>
                    <label className="mission-answer-choice"><input type="radio" name={`q${index}CorrectOption`} value="Falso" required /> Falso</label>
                  </div>
                </div>
              )}

              {question.type === "open_text" && <div className="notice">Questão discursiva: não há gabarito automático. Ela irá para Correções quando o aluno responder.</div>}

              <div className="field"><label>Pista <span className="field-optional">opcional</span></label><input className="input" name={`q${index}Hint`} /></div>
            </article>
          ))}
        </div>

        <div className="flex gap-8 wrap mt-16">
          <button className="button button-secondary" type="button" onClick={addQuestion} disabled={questions.length >= 20}>+ Adicionar outra questão</button>
          <button className="button button-primary" type="submit">Criar missão</button>
        </div>
      </section>
    </form>
  );
}
