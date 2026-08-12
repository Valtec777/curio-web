"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCurioSounds } from "@/components/use-curio-sounds";
import styles from "./curio-playful-sound-effects.module.css";

function normalizedSuccess(params: URLSearchParams) {
  return (params.get("sucesso") || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

export function CurioPlayfulSoundEffects({ viewerId }: { viewerId: string }) {
  const pathname = usePathname();
  const { enabled, ready, play, toggle } = useCurioSounds(viewerId);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    if (!pathname.startsWith("/aluno/missoes")) return;

    const params = new URLSearchParams(window.location.search);
    const success = normalizedSuccess(params);
    const missionCompleted = success.includes("missão enviada") || success.includes("missão concluída");
    if (!missionCompleted) return;

    const eventId = params.get("evento") || `${window.location.pathname}${window.location.search}`;
    const consumedKey = `curio:mission-sound:v1:${viewerId}:${eventId}`;
    if (window.sessionStorage.getItem(consumedKey) === "played") return;
    window.sessionStorage.setItem(consumedKey, "played");

    play("mission-complete");

    const achievementCount = Math.max(0, Number(params.get("conquistas") || 0));
    if (achievementCount > 0) {
      const timer = window.setTimeout(() => play("achievement"), 560);
      return () => window.clearTimeout(timer);
    }
  }, [pathname, play, ready, viewerId]);

  return (
    <button
      type="button"
      className={styles.soundToggle}
      data-curio-sound-toggle
      data-enabled={enabled ? "true" : "false"}
      aria-pressed={enabled}
      aria-label={enabled ? "Desativar sons de Missões e Conquistas" : "Ativar sons de Missões e Conquistas"}
      title={enabled ? "Sons de Missões e Conquistas ligados · clique para desligar" : "Sons de Missões e Conquistas desligados · clique para ligar"}
      onClick={toggle}
    >
      <span aria-hidden="true">{enabled ? "🔊" : "🔇"}</span>
    </button>
  );
}
