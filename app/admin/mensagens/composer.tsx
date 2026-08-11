"use client";

import { useMemo, useState } from "react";
import { sendAdminFamilyMessage } from "./actions";

type Template = {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
};

type Props = {
  studentId: string;
  studentName: string;
  guardianId: string;
  guardianName: string;
  teacherName: string;
  requestKey: string;
  templates: Template[];
};

function renderVariables(value: string, variables: Record<string, string>) {
  return value.replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}/gi, (match, name: string) => variables[name.toLowerCase()] || match);
}

function unresolvedVariables(values: string[]) {
  const unresolved = new Set<string>();
  for (const value of values) {
    for (const match of value.matchAll(/\{\{\s*([a-z0-9_.]+)\s*\}\}/gi)) unresolved.add(match[1]);
  }
  return [...unresolved];
}

export function AdminFamilyMessageComposer({
  studentId,
  studentName,
  guardianId,
  guardianName,
  teacherName,
  requestKey,
  templates,
}: Props) {
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [actionUrl, setActionUrl] = useState("");

  const variables = useMemo(() => ({
    responsavel_nome: guardianName,
    "responsavel.nome": guardianName,
    aluno_nome: studentName,
    "aluno.nome": studentName,
    professor_nome: teacherName,
    "professor.nome": teacherName,
  }), [guardianName, studentName, teacherName]);

  const preview = useMemo(() => ({
    subject: renderVariables(subject, variables),
    body: renderVariables(body, variables),
    actionLabel: renderVariables(actionLabel, variables),
    actionUrl: renderVariables(actionUrl, variables),
  }), [subject, body, actionLabel, actionUrl, variables]);
  const unresolved = useMemo(() => unresolvedVariables([preview.subject, preview.body, preview.actionLabel, preview.actionUrl]), [preview]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) {
      setSubject("");
      setBody("");
      setActionLabel("");
      setActionUrl("");
      return;
    }
    setSubject(template.subject);
    setBody(template.body);
    setActionLabel(template.actionLabel);
    setActionUrl(template.actionUrl);
  }

  return (
    <form action={sendAdminFamilyMessage} className="form-stack compact-form">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="guardianId" value={guardianId} />
      <input type="hidden" name="requestKey" value={requestKey} />

      <div className="field">
        <label>Mensagem pronta</label>
        <select className="select" value={templateId} onChange={(event) => applyTemplate(event.target.value)}>
          <option value="">Escrever mensagem personalizada</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
        {templateId ? <small className="muted">{templates.find((item) => item.id === templateId)?.description}</small> : null}
      </div>

      <div className="field"><label>Assunto</label><input className="input" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Ex.: Sobre a próxima aula" required maxLength={160} /></div>
      <div className="field"><label>Mensagem</label><textarea className="textarea" name="body" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Escreva a mensagem para a família." required maxLength={5000} /></div>
      <div className="form-row">
        <div className="field"><label>Texto do botão <span className="field-optional">opcional</span></label><input className="input" name="actionLabel" value={actionLabel} onChange={(event) => setActionLabel(event.target.value)} placeholder="Ex.: Ver agenda" maxLength={80} /></div>
        <div className="field"><label>Destino do botão</label><input className="input" name="actionUrl" value={actionUrl} onChange={(event) => setActionUrl(event.target.value)} placeholder="/familia/agenda ou https://..." maxLength={500} /></div>
      </div>

      {templateId ? (
        <div className="notice">
          <strong>Prévia:</strong> {preview.subject || "Sem assunto"}
          <p>{preview.body || "Sem mensagem"}</p>
          {unresolved.length ? <small>Falta resolver: {unresolved.map((item) => `{{${item}}}`).join(", ")}</small> : <small>Os nomes serão confirmados novamente pelo servidor antes do envio.</small>}
        </div>
      ) : null}

      <button className="button button-primary button-small" type="submit" disabled={unresolved.length > 0}>Enviar para a família</button>
    </form>
  );
}
