"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateTeacherActivity } from "./actions";

type Option = { id: string; name: string };

const MAX_FILE_BYTES = 15 * 1024 * 1024;

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 110) || "fonte";
}

function inferMimeType(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (name.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  return "";
}

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const questionTypes = [
  ["multiple_choice", "Múltipla escolha"],
  ["true_false", "Verdadeiro ou falso"],
  ["open_text", "Discursiva"],
  ["matching", "Associação"],
  ["fill_blank", "Complete a frase"],
  ["ordering", "Ordenação"],
  ["interpretation", "Interpretação"],
  ["problem", "Situação-problema"],
] as const;

export function TeacherActivityGeneratorForm({ subjects, grades }: { subjects: Option[]; grades: Option[] }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [localError, setLocalError] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setLocalError("");
    setStatus("Preparando geração...");

    try {
      const fileValue = formData.get("sourceFile");
      const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

      if (file) {
        if (file.size > MAX_FILE_BYTES) throw new Error("O arquivo deve ter até 15 MB.");
        const mimeType = inferMimeType(file);
        if (!allowedMimeTypes.has(mimeType)) throw new Error("Envie PDF, DOCX, PPTX, TXT, PNG, JPG ou WEBP.");

        setStatus("Enviando a fonte com segurança...");
        const supabase = createClient();
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) throw new Error("Sua sessão expirou. Entre novamente e tente outra vez.");

        const path = `${userData.user.id}/activity-generator/${Date.now()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("generation-sources").upload(path, file, {
          contentType: mimeType,
          upsert: false,
        });
        if (uploadError) throw new Error("Não foi possível enviar o arquivo. Tente novamente.");

        formData.delete("sourceFile");
        formData.set("sourceFilePath", path);
        formData.set("sourceFileName", file.name);
        formData.set("sourceMimeType", mimeType);
        formData.set("sourceFileSize", String(file.size));
      } else {
        formData.delete("sourceFile");
      }

      setStatus("Gerando conteúdo e questões...");
      await generateTeacherActivity(formData);
    } catch (error) {
      setBusy(false);
      setStatus("");
      setLocalError(error instanceof Error ? error.message : "Não foi possível iniciar a geração.");
    }
  }

  return (
    <form action={submit} className="form-stack">
      {localError ? <div className="form-message form-error">{localError}</div> : null}
      {status ? <div className="notice"><strong>{status}</strong> Não feche esta página enquanto o rascunho está sendo preparado.</div> : null}

      <div className="form-row">
        <div className="field">
          <label>Título</label>
          <input className="input" name="title" placeholder="Ex.: Frações equivalentes — revisão" required disabled={busy} />
        </div>
        <div className="field">
          <label>Formato que você quer gerar</label>
          <select className="select" name="outputType" defaultValue="mission" disabled={busy}>
            <option value="mission">Missão</option>
            <option value="quiz">Quiz</option>
            <option value="activity">Atividade</option>
            <option value="material">Material</option>
            <option value="assessment">Avaliação</option>
            <option value="notebook_pdf">Caderno</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Matéria</label>
          <select className="select" name="subjectId" defaultValue="" disabled={busy}>
            <option value="">Inferir / escolher depois</option>
            {subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Série / ano</label>
          <select className="select" name="gradeId" defaultValue="" disabled={busy}>
            <option value="">Inferir / escolher depois</option>
            {grades.map((grade) => <option value={grade.id} key={grade.id}>{grade.name}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Tema</label>
          <input className="input" name="theme" placeholder="Ex.: frações, sistema solar, interpretação" disabled={busy} />
        </div>
        <div className="field">
          <label>Objetivo</label>
          <input className="input" name="objective" placeholder="Ex.: identificar e comparar frações equivalentes" disabled={busy} />
        </div>
      </div>

      <div className="field">
        <label>Instruções para a geração</label>
        <textarea className="textarea" name="instructions" placeholder="Ex.: linguagem simples, 4 alternativas por questão, exemplos do cotidiano, foco em interpretação. Você também pode colar aqui o texto-base." disabled={busy} />
      </div>

      <div className="generator-input-grid">
        <div className="field">
          <label>Arquivo fonte <span className="field-optional">opcional</span></label>
          <input className="input" name="sourceFile" type="file" accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg,image/webp" disabled={busy} />
          <small className="muted">PDF, DOCX, PPTX, TXT ou imagem · até 15 MB. O arquivo é enviado direto ao armazenamento privado antes da geração.</small>
        </div>
        <div className="generator-upload-drop">
          <strong>Modelo pronto para preencher</strong>
          <p>Use um único modelo com os campos que o gerador reconhece para Missão, Quiz, Atividade, Material, Avaliação ou Caderno.</p>
          <a className="button button-secondary button-small" href="/modelos/modelo-geracao-atividade.txt" download>Baixar modelo universal</a>
          <small>Você pode preencher o TXT diretamente ou abrir em Docs/Word e exportar como DOCX ou PDF antes de anexar.</small>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Quantidade de questões</label>
          <input className="input" type="number" name="desiredQuestionCount" min="0" max="50" defaultValue="10" disabled={busy} />
        </div>
        <div className="field">
          <label>Dificuldade</label>
          <select className="select" name="difficulty" defaultValue="medium" disabled={busy}>
            <option value="easy">Mais acessível</option>
            <option value="medium">Intermediária</option>
            <option value="hard">Desafiadora</option>
          </select>
        </div>
        <div className="field">
          <label>Duração estimada (min)</label>
          <input className="input" type="number" name="estimatedMinutes" min="1" max="300" defaultValue="20" disabled={busy} />
        </div>
      </div>

      <div className="field">
        <label>Tipos de questão</label>
        <div className="flex gap-8 wrap">
          {questionTypes.map(([value, label]) => (
            <label className="consent-line" key={value}>
              <input type="checkbox" name="questionTypes" value={value} defaultChecked={["multiple_choice", "true_false", "open_text"].includes(value)} disabled={busy} /> {label}
            </label>
          ))}
        </div>
      </div>

      <div className="form-row">
        <label className="consent-line"><input type="checkbox" name="includeExplanations" defaultChecked disabled={busy} /> Gerar explicação da resposta em cada questão</label>
        <label className="consent-line"><input type="checkbox" name="includeHints" disabled={busy} /> Gerar pistas sem entregar a resposta</label>
      </div>

      <div className="form-row">
        <div className="field"><label>Habilidade <span className="field-optional">opcional</span></label><input className="input" name="skillText" placeholder="Código ou descrição" disabled={busy} /></div>
        <div className="field"><label>Faixa etária <span className="field-optional">opcional</span></label><input className="input" name="ageLabel" placeholder="Ex.: 12 a 14 anos" disabled={busy} /></div>
      </div>

      <div className="field">
        <label>Observações finais <span className="field-optional">opcional</span></label>
        <textarea className="textarea textarea-compact" name="notes" placeholder="Ex.: evitar pegadinhas, incluir resolução passo a passo, usar vocabulário específico..." disabled={busy} />
      </div>

      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Gerando atividade..." : "Gerar atividade agora"}</button>
      <small className="muted">A geração cria um rascunho. Nada é publicado ou enviado automaticamente; você revisa e depois escolhe os alunos no fluxo final.</small>
    </form>
  );
}
