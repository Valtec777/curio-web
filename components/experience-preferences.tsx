"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CURIO_SOUND_KEY, playCurioSound } from "@/lib/curio-sounds";

type ThemeMode = "system" | "light" | "dark";

type Preferences = {
  theme: ThemeMode;
  visual: boolean;
  epilepsy: boolean;
  focus: boolean;
  sound: boolean;
};

const defaults: Preferences = {
  theme: "system",
  visual: false,
  epilepsy: false,
  focus: false,
  sound: false,
};

function readPreferences(): Preferences {
  if (typeof window === "undefined") return defaults;
  try {
    const stored = window.localStorage.getItem(CURIO_SOUND_KEY);
    return stored ? { ...defaults, ...(JSON.parse(stored) as Partial<Preferences>) } : defaults;
  } catch {
    return defaults;
  }
}

function resolvedTheme(theme: ThemeMode) {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyPreferences(preferences: Preferences) {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme(preferences.theme);
  root.dataset.themeMode = preferences.theme;
  root.dataset.accessVisual = String(preferences.visual);
  root.dataset.accessEpilepsy = String(preferences.epilepsy);
  root.dataset.accessFocus = String(preferences.focus);
  root.dataset.sound = String(preferences.sound);
  root.style.colorScheme = root.dataset.theme;

  if (preferences.epilepsy) {
    document.querySelectorAll("video").forEach((video) => {
      video.pause();
      video.removeAttribute("autoplay");
    });
  }
}

export function ExperiencePreferences() {
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const pathname = usePathname();
  const isStudentArea = pathname.startsWith("/aluno") && pathname !== "/aluno/desbloquear-familia";

  useEffect(() => {
    const initial = readPreferences();
    setPreferences(initial);
    applyPreferences(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      const current = readPreferences();
      if (current.theme === "system") applyPreferences(current);
    };
    media.addEventListener?.("change", syncSystemTheme);

    const params = new URLSearchParams(window.location.search);
    const success = (params.get("sucesso") || "").toLocaleLowerCase("pt-BR");
    if (isStudentArea && (success.includes("missão enviada") || success.includes("missão concluída"))) {
      window.setTimeout(() => playCurioSound("mission-complete"), 250);
    }

    return () => media.removeEventListener?.("change", syncSystemTheme);
  }, [isStudentArea, pathname]);

  function update(patch: Partial<Preferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    window.localStorage.setItem(CURIO_SOUND_KEY, JSON.stringify(next));
    applyPreferences(next);
  }

  return (
    <div className="experience-preferences" data-open={open ? "true" : "false"}>
      <button
        className="experience-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="curio-experience-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">Aa</span>
        <span className="sr-only">Aparência e acessibilidade</span>
      </button>

      {open && (
        <section className="experience-panel" id="curio-experience-panel" aria-label="Aparência e acessibilidade">
          <div className="experience-panel-head">
            <div>
              <strong>Aparência e acessibilidade</strong>
              <small>Preferências deste dispositivo. Você pode alterar quando quiser.</small>
            </div>
            <button className="experience-close" type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
          </div>

          <div className="experience-group">
            <span className="experience-label">Tema</span>
            <div className="segmented-control" role="group" aria-label="Tema do site">
              {(["light", "dark", "system"] as ThemeMode[]).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  aria-pressed={preferences.theme === theme}
                  onClick={() => update({ theme })}
                >
                  {theme === "light" ? "Claro" : theme === "dark" ? "Escuro" : "Sistema"}
                </button>
              ))}
            </div>
          </div>

          <label className="preference-toggle">
            <span><strong>Leitura reforçada</strong><small>Aumenta a fonte e reforça contraste, foco e contornos.</small></span>
            <input type="checkbox" checked={preferences.visual} onChange={(event) => update({ visual: event.target.checked })} />
          </label>

          <label className="preference-toggle">
            <span><strong>Reduzir estímulos</strong><small>Reduz animações, transições e elementos decorativos em movimento.</small></span>
            <input type="checkbox" checked={preferences.epilepsy} onChange={(event) => update({ epilepsy: event.target.checked })} />
          </label>

          <label className="preference-toggle">
            <span><strong>Foco e simplicidade</strong><small>Prioriza o conteúdo essencial e reduz distrações visuais.</small></span>
            <input type="checkbox" checked={preferences.focus} onChange={(event) => update({ focus: event.target.checked })} />
          </label>

          {isStudentArea && (
            <>
              <label className="preference-toggle">
                <span><strong>Sons rápidos do Curió</strong><small>Feedback curto para acertos, erros e conclusão. Vem desligado por padrão.</small></span>
                <input type="checkbox" checked={preferences.sound} onChange={(event) => update({ sound: event.target.checked })} />
              </label>

              {preferences.sound && (
                <div className="sound-preview" aria-label="Testar sons">
                  <button type="button" onClick={() => playCurioSound("correct")}>Acerto</button>
                  <button type="button" onClick={() => playCurioSound("incorrect")}>Erro</button>
                  <button type="button" onClick={() => playCurioSound("mission-complete")}>Missão concluída</button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
