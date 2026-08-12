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
  contextKind: "agenda" | "mission" | "";
};

type MessageContext = {
  kind: "agenda" | "mission";
  id: string;
  studentId: string;
  label: string;
  agendaTitle: string;
  agendaDate: string;
  agendaTime: string;
  agendaLink: string;
  missionName: string;
  missionDue: string;
};

function variablesFor(target: Target | undefined, teacherName: string, context: MessageContext | undefined) {
  if (!target) return {} as Record<string, string>;
  return {
    responsavel_nome: target.guardianName,
    "responsavel.nome": target.guardianName,
    aluno_nome: target.studentName,
    "aluno.nome": target.studentName,
    professor_nome: teacherName,
    "professor.nome": teacherName,
    escola: target.schoolName || "escola não informada",
    ano_escolar: target.gradeName || "ano escolar não informado",
    agenda_titulo: context?.kind === "agenda" ? context.agendaTitle : "",
    "agenda.titulo": context?.kind === "agenda" ? context.agendaTitle : "",
    agenda_data: context?.kind === "agenda" ? context.agendaDate : "",
    "agenda.data": context?.kind === "agenda" ? context.agendaDate : "",
    agenda_horario: context?.kind === "agenda" ? context.agendaTime : "",
    "agenda.horario": context?.kind === "agenda" ? context.agendaTime : "",
    agenda_link: context?.kind === "agenda" ? context.agendaLink : "",
    "agenda.link": context?.kind === "agenda" ? context.agendaLink : "",
    missao_nome: context?.kind === "mission" ? context.missionName : "",
    "missao.nome": context?.kind === "mission" ? context.missionName : "",
    missao_prazo: context?.kind === "mission" ? context.missionDue : "",
    "missao.prazo": context?.kind === "mission" ? context.missionDue : "",
  };
}

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

export function FamilyMessageComposer({
  targets,
  templates,
  contexts,
  teacherName,
  requestKey,
}: {
  targets: Target[];
  templates: Template[];
  contexts: MessageContext[];
  teacherName: string;
  requestKey: string;
}) {
  const firstTemplate = templates[0];
  const [targetIndex, setTargetIndex] = useState(0);
  const [templateId, setTemplateId] = useState(firstTemplate?.id || "");
  const [contextKey, setContextKey] = useState("");
  const [subject, setSubject] = useState(firstTemplate?.subject || "");
  const [body, setBody] = useState(firstTemplate?.body || "");
  const [actionLabel, setActionLabel] = useState(firstTemplate?.actionLabel || "");
  const [actionUrl, setActionUrl] = useState(firstTemplate?.actionUrl || "");

  const target = targets[targetIndex];
  const context = contexts.find((item) => `${item.kind}:${item.id}` === contextKey);
  const contextsForTarget = useMemo(() => contexts.filter((item) => item.studentId === target?.studentId), [contexts, target?.studentId]);
  const currentTemplate = templates.find((item) => item.id === templateId);
  const variables = useMemo(() => variablesFor(target, teacherName, context), [target, teacherName, context]);
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
    if (!template) return;
    setSubject(template.subject);
    setBody(template.body);
    setActionLabel(template.actionLabel);
    setActionUrl(template.actionUrl);
  }

  function changeTarget(index: number) {
    const nextTarget = targets[index];
    setTargetIndex(index);
    if (context && context.studentId !== nextTarget?.studentId) setContextKey("");
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
            <p>Escolha uma família, um modelo e, quando necessário, o encontro ou a missão real que preencherá as variáveis.</p>
          </div>
        </div>

        <form action={sendFamilyMessage} className="form-stack">
          <input type="hidden" name="returnPath" value="/professor/mensagens" />
          <input type="hidden" name="requestKey" value={requestKey} />
          <input type="hidden" name="studentId" value={target?.studentId || ""} />
          <input type="hidden" name="guardianId" value={target?.guardianId || ""} />
          <input type="hidden" name="contextKind" value={context?.kind || ""} />
          <input type="hidden" name="contextId" value={context?.id || ""} />

          <div className="field">
            <label>Família / aluno</label>
            <select className="select" value={targetIndex} onChange={(event) => changeTarget(Number(event.target.value))}>
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
            {currentTemplate?.description && <small className="muted">{currentTemplate.description}</small>}
          </div>

          <div className="field">
            <label>Contexto real (opcional)</label>
            <select className="select" value={contextKey} onChange={(event) => setContextKey(event.target.value)}>
              <option value="">Sem encontro/missão específica</option>
              {contextsForTarget.map((item) => <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{item.label}</option>)}
            </select>
            <small className="muted">
              {currentTemplate?.contextKind ? `Este modelo usa dados de ${currentTemplate.contextKind === "agenda" ? "Agenda" : "Missão"}. ` : ""}
              Variáveis aceitas: {"{{aluno.nome}}"}, {"{{responsavel.nome}}"}, {"{{professor.nome}}"}, {"{{agenda.data}}"}, {"{{agenda.horario}}"}, {"{{agenda.link}}"}, {"{{missao.nome}}"}, {"{{missao.prazo}}"}.
            </small>
          </div>

          <div className="field">
            <label>Assunto</label>
            <input className="input" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={160} />
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
              <input className="input" name="actionUrl" value={actionUrl} onChange={(event) => setActionUrl(event.target.value)} maxLength={500} placeholder="/familia/agenda, https://... ou {{agenda.link}}" />
            </div>
          </div>

          <MessageSubmitButton />
        </form>
      </section>

      <section className="panel family-highlight">
        <div className="panel-head">
          <div>
            <h2>Preview para a família</h2>
            <p>O servidor resolve e valida tudo novamente antes de salvar; nenhuma variável sem valor é enviada ao usuário final.</p>
          </div>
        </div>
        {unresolved.length > 0 && <div className="form-message form-error">Falta preencher: {unresolved.map((item) => `{{${item}}}`).join(", ")}. Escolha o contexto correspondente ou remova a variável.</div>}
        <article className="mission-card">
          <strong>{preview.subject || "Assunto da mensagem"}</strong>
          <p>{preview.body || "Escreva a mensagem para visualizar aqui."}</p>
          <small className="muted">Para {target?.guardianName || "Responsável"} • sobre {target?.studentName || "Aluno"}</small>
          {context && <p className="muted">Contexto: {context.label}</p>}
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
