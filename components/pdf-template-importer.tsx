"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseTeacherTemplatePdf } from "@/app/professor/pdf-template-actions";

type Target = "mission" | "material" | "assessment";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 110) || "modelo.pdf";
}

export function PdfTemplateImporter({
  target,
  templateHref,
  onImported,
}: {
  target: Target;
  templateHref: string;
  onImported: (data: any) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function importPdf() {
    const file = inputRef.current?.files?.[0] || null;
    setError("");
    if (!file) return setError("Escolha o PDF preenchido antes de importar.");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setError("O arquivo de preenchimento precisa ser um PDF.");
    if (file.size > MAX_FILE_BYTES) return setError("O PDF deve ter até 15 MB.");

    setBusy(true);
    try {
      setStatus("Enviando o PDF com segurança...");
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sua sessão expirou. Entre novamente e tente outra vez.");

      const path = `${userData.user.id}/template-import/${target}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("generation-sources").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (uploadError) throw new Error("Não foi possível enviar o PDF. Tente novamente.");

      setStatus("Lendo o modelo e preenchendo os campos...");
      const parsed = await parseTeacherTemplatePdf({
        target,
        filePath: path,
        fileName: file.name,
        mimeType: "application/pdf",
        fileSize: file.size,
      });
      onImported(parsed);
      setStatus("Campos preenchidos. Confira tudo antes de salvar.");
    } catch (caught) {
      setStatus("");
      setError(caught instanceof Error ? caught.message : "Não foi possível importar o PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="teacher-pdf-import-box">
      <div className="teacher-pdf-import-copy">
        <strong>Preencher mais rápido com PDF</strong>
        <p>Baixe o modelo, use no ChatGPT para montar o conteúdo e depois importe o PDF aqui. O Plumareli lê a ficha e preenche o formulário; você só revisa e escolhe os alunos.</p>
      </div>
      <div className="flex gap-8 wrap">
        <a className="button button-secondary button-small" href={templateHref} download>Baixar modelo PDF</a>
        <input ref={inputRef} className="input teacher-pdf-import-input" type="file" accept="application/pdf,.pdf" disabled={busy} />
        <button className="button button-primary button-small" type="button" onClick={importPdf} disabled={busy}>{busy ? "Lendo PDF..." : "Importar e preencher"}</button>
      </div>
      {status ? <div className="notice teacher-pdf-import-status">{status}</div> : null}
      {error ? <div className="form-message form-error teacher-pdf-import-status">{error}</div> : null}
      <small className="muted">O PDF nunca escolhe alunos nem publica sozinho. Esses passos continuam sob controle do professor.</small>
    </section>
  );
}
