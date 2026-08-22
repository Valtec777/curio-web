"use client";

import { useEffect, useMemo, useState } from "react";

type ReadingAutonomy = "independent" | "developing" | "needs_support";

type StudentLearningSupportProps = {
  readingAutonomy: ReadingAutonomy;
  guidedMode: boolean;
  audioInstructions: boolean;
};

function uniqueText(values: string[]) {
  return values
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index)
    .join(". ");
}

export function StudentLearningSupport({ readingAutonomy, guidedMode, audioInstructions }: StudentLearningSupportProps) {
  const [speaking, setSpeaking] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(true);

  const supportLabel = useMemo(() => {
    if (readingAutonomy === "needs_support") return "Leitura com apoio";
    if (readingAutonomy === "developing") return "Leitura em desenvolvimento";
    return "Leitura com autonomia";
  }, [readingAutonomy]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.studentGuided = String(guidedMode);
    root.dataset.readingAutonomy = readingAutonomy;
    root.dataset.audioInstructions = String(audioInstructions);
    setSpeechAvailable("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);

    return () => {
      delete root.dataset.studentGuided;
      delete root.dataset.readingAutonomy;
      delete root.dataset.audioInstructions;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [audioInstructions, guidedMode, readingAutonomy]);

  function stop() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function readInstructions() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setSpeechAvailable(false);
      return;
    }

    if (speaking) {
      stop();
      return;
    }

    const marked = Array.from(document.querySelectorAll<HTMLElement>("[data-audio-instruction]"));
    const fallback = Array.from(document.querySelectorAll<HTMLElement>(
      ".app-main .page-header h1, .app-main .page-header p, .app-main .kid-hero h1, .app-main .kid-hero p, .app-main .panel-head p"
    ));
    const text = uniqueText((marked.length ? marked : fallback).map((element) => element.innerText));

    if (!text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = readingAutonomy === "needs_support" ? 0.82 : readingAutonomy === "developing" ? 0.9 : 0.98;
    utterance.pitch = 1;
    const portugueseVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("pt-br"))
      || window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("pt"));
    if (portugueseVoice) utterance.voice = portugueseVoice;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <>
      {guidedMode ? (
        <aside className="student-guided-banner" aria-label="Modo Acompanhado ativo">
          <div>
            <strong>Modo Acompanhado ativo</strong>
            <span>{supportLabel}. Um responsável pode ajudar a entrar, navegar ou ler as instruções. Pensar e responder continua sendo tarefa do aluno.</span>
          </div>
        </aside>
      ) : null}

      {audioInstructions ? (
        <div className="student-audio-assistant" aria-live="polite">
          <button className="button button-primary student-audio-button" type="button" onClick={readInstructions} disabled={!speechAvailable}>
            <span aria-hidden="true">{speaking ? "■" : "🔊"}</span>
            {speaking ? "Parar áudio" : "Ouvir instruções"}
          </button>
          {!speechAvailable ? <small>A leitura em voz alta não está disponível neste navegador.</small> : null}
        </div>
      ) : null}
    </>
  );
}
