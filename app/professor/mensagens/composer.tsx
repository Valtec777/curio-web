"use client";

import { useMemo, useState } from "react";
import { sendFamilyMessage } from "@/app/message-actions";
import { MessageSubmitButton } from "./submit-button";

type Target = {
  studentId: string;
  studentName: string;
  guardianId: string;
  guardianName: string;
  relationship: string;
  schoolName: string;
  gradeName: string;
};

type Template = {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
};

function renderVariables(value: string, target: Target | undefined, teacherName: string) {
  if (!target) return value;
  const variables: Record<string, string> = {
    responsavel_nome: target.guardianName,
    aluno_nome: target.studentName,
    professor_nome: teacherName,
    escola: target.schoolName || "escola não informada",
    ano_escolar: target.gradeName || "ano escolar não informado",
  };
  return value.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, name: string) => variables[name.toLowerCase()] ?? match);
}

export function FamilyMessageComposer({
  targets,
  templates,
  teacherName,
  requestKey,
}: {
  targets: Target[];
  templates: Template[];
  teacherName: string;
  requestKey: string;
}) {
  const firstTemplate = templates[0];
  const [targetIndex, setTargetIndex] = useState(0);
  const [templateId, setTemplateId] = useState(firstTemplate?.id || "");
  const [subject, setSubject] = useState(firstTemplate?.subject || "");
  const [body, setBody] = useState(firstTemplate?.body || "");
  const [actionLabel, setActionLabel] = useState(firstTemplate?.actionLabel || "");
  const [actionUrl, setActionUrl] = useState(firstTemplate?.actionUrl || "");

  const target = targets[targetIndex];
  const preview = useMemo(() => ({
    subject: renderVariables(subject, target, teacherName),
    body: renderVariables(body, target, teacherName),
    actionLabel: renderVariables(actionLabel, target, teacherName),
    actionUrl: renderVariables(actionUrl, target, teacherName),
  }), [subject, body, actionLabel, actionUrl, target, teacherName]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setSubject(template.subject);
    setBody(template.body);
    setActionLabel(template.actionLabel);
    setActionUrl(template.actionUrl);
  }

  if (!targets.length) {
    return <div className="notice">Nenhuma família vinculada aos seus alunos está disponível para mensagem.</div>;
  }

  return (
    <div className="grid-2">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Nova mensagem</h2>
            <p>Escolha um modelo ou escreva livremente. As variáveis são resolvidas no preview e novamente no servidor antes do envio.</p>
          </div>
        </div>

        <form action={sendFamilyMessage} className="form-stack">
          <input type="hidden" name="returnPath" value="/professor/mensagens" />
          <input type="hidden" name="requestKey" value={requestKey} />
          <input type="hidden" name="studentId" value={target?.studentId || ""} />
          <input type="hidden" name="guardianId" value={target?.guardianId || ""} />

          <div className="field">
            <label>Família / aluno</label>
            <select className="select" value={targetIndex} onChange={(event) => setTargetIndex(Number(event.target.value))}>
              {targets.map((item, index) => (
                <option key={`${item.studentId}-${item.guardianId}`} value={index}>
                  {item.studentName} — {item.guardianName} ({item.relationship})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Mensagem pronta</label>
            <select className="select" value={templateId} onChange={(event) => applyTemplate(event.target.value)}>
              <option value="">Escrever sem modelo</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            <small className="muted">Variáveis disponíveis: {"{{responsavel_nome}}"}, {"{{aluno_nome}}"}, {"{{professor_nome}}"}, {"{{escola}}"}, {"{{ano_escolar}}"}.</small>
          </div>

          <div className="field">
            <label>Assunto</label>
            <input className="input" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={300} />
          </div>

          <div className="field">
            <label>Mensagem</label>
            <textarea className="textarea" name="body" value={body} onChange={(event) => setBody(event.target.value)} required maxLength={5000} />
          </div>

          <div className="form-row">
            <div className="field">
              <label>Texto do botão (opcional)</label>
              <input className="input" name="actionLabel" value={actionLabel} onChange={(event) => setActionLabel(event.target.value)} maxLength={80} placeholder="Ex.: Ver agenda" />
            </div>
            <div className="field">
              <label>Destino do botão</label>
              <input className="input" name="actionUrl" value={actionUrl} onChange={(event) => setActionUrl(event.target.value)} maxLength={500} placeholder="/familia/agenda ou https://..." />
            </div>
          </div>

          <MessageSubmitButton />
        </form>
      </section>

      <section className="panel family-highlight">
        <div className="panel-head">
          <div>
            <h2>Preview para a família</h2>
            <p>Este é o texto que será salvo na conversa após a resolução das variáveis.</p>
          </div>
        </div>
        <article className="mission-card">
          <strong>{preview.subject || "Assunto da mensagem"}</strong>
          <p>{preview.body || "Escreva a mensagem para visualizar aqui."}</p>
          <small className="muted">Para {target?.guardianName || "Responsável"} • sobre {target?.studentName || "Aluno"}</small>
          {preview.actionLabel && preview.actionUrl && (
            <div className="mt-12">
              <span className="button button-secondary button-small" aria-hidden="true">{preview.actionLabel}</span>
              <small className="muted"> Destino: {preview.actionUrl}</small>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
