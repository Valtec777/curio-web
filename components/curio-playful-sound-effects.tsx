"use client";

import { useEffect } from "react";
import { useCurioSounds } from "@/components/use-curio-sounds";
import styles from "./curio-playful-sound-effects.module.css";

function normalizedLabel(element: Element) {
  return (element.getAttribute("aria-label") || element.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function belongsToCurioHelp(element: Element) {
  const dialog = element.closest('[role="dialog"]');
  const dialogLabel = dialog?.getAttribute("aria-labelledby") || "";
  if (dialogLabel.startsWith("curio-")) return true;

  const menu = element.closest('[role="menu"]');
  const menuLabel = menu?.getAttribute("aria-label") || "";
  if (menuLabel.toLocaleLowerCase("pt-BR").includes("cURIÓ".toLocaleLowerCase("pt-BR"))) return true;

  return normalizedLabel(element) === "como usar";
}

export function CurioPlayfulSoundEffects({ viewerId }: { viewerId: string }) {
  const { enabled, play, toggle } = useCurioSounds(viewerId);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const origin = event.target;
      if (!(origin instanceof Element)) return;

      const control = origin.closest("button, a");
      if (!control || control.hasAttribute("data-curio-sound-toggle")) return;
      if (!belongsToCurioHelp(control)) return;

      const label = normalizedLabel(control);

      if (label.includes("concluir")) {
        play("celebrate");
        return;
      }
      if (label.includes("próximo")) {
        play("step");
        return;
      }
      if (label.includes("começar tour") || label.includes("ver tour completo") || label.includes("explicar esta página")) {
        play("discover");
        return;
      }
      if (label === "entendi") {
        play("success");
        return;
      }

      play("tap");
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [play]);

  return (
    <button
      type="button"
      className={styles.soundToggle}
      data-curio-sound-toggle
      data-enabled={enabled ? "true" : "false"}
      aria-pressed={enabled}
      aria-label={enabled ? "Desativar sons do CURIÓ" : "Ativar sons do CURIÓ"}
      title={enabled ? "Sons ligados · clique para desligar" : "Sons desligados · clique para ligar"}
      onClick={toggle}
    >
      <span aria-hidden="true">{enabled ? "🔊" : "🔇"}</span>
    </button>
  );
}
