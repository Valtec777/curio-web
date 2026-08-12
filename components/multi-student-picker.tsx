"use client";

import { useMemo, useState } from "react";

type StudentOption = { id: string; name: string; detail?: string };

export function MultiStudentPicker({
  students,
  name = "studentIds",
  defaultSelected = [],
}: {
  students: StudentOption[];
  name?: string;
  defaultSelected?: string[];
}) {
  const validIds = useMemo(() => new Set(students.map((student) => student.id)), [students]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSelected.filter((id) => validIds.has(id))),
  );

  const allSelected = students.length > 0 && selected.size === students.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(students.map((student) => student.id)));
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!students.length) {
    return <p className="muted">Nenhum aluno ativo está vinculado a você.</p>;
  }

  return (
    <div className="form-stack compact-form">
      <div className="flex space-between gap-8 wrap">
        <small className="muted">{selected.size ? `${selected.size} aluno(s) selecionado(s)` : "Escolha um ou mais alunos"}</small>
        <button className="button button-ghost button-small" type="button" onClick={toggleAll}>
          {allSelected ? "Limpar seleção" : "Selecionar todos"}
        </button>
      </div>
      <div className="teacher-student-picker">
        {students.map((student) => (
          <label className="teacher-student-choice" key={student.id}>
            <input
              type="checkbox"
              name={name}
              value={student.id}
              checked={selected.has(student.id)}
              onChange={() => toggle(student.id)}
            />
            <span>
              <strong>{student.name}</strong>
              {student.detail && <small className="muted"> · {student.detail}</small>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
