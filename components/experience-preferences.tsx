"use client";

import { useEffect, useState } from "react";

type ThemeMode = "system" | "light" | "dark";
type TextSize = "default" | "large" | "extra";

type Preferences = {
  theme: ThemeMode;
  textSize: TextSize;
  visual: boolean;
  epilepsy: boolean;
  focus: boolean;
};

const EXPERIENCE_PREFERENCES_KEY = "curio:experience-preferences:v1";

const defaults: Preferences = {
  theme: "system",
  textSize: "default",
  visual: false,
  epilepsy: false,
  focus: false,
};

function readPreferences(): Preferences {
  if (typeof window === "undefined") return defaults;
  try {
    const stored = window.localStorage.getItem(EXPERIENCE_PREFERENCES_KEY);
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
  root.dataset.textSize = preferences.textSize;
  root.dataset.accessVisual = String(preferences.visual);
  root.dataset.accessEpilepsy = String(preferences.epilepsy);
  root.dataset.accessFocus = String(preferences.focus);
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

    return () => media.removeEventListener?.("change", syncSystemTheme);
  }, []);

  function update(patch: Partial<Preferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    window.localStorage.setItem(EXPERIENCE_PREFERENCES_KEY, JSON.stringify(next));
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

          <div className="experience-group">
            <span className="experience-label">Tamanho do texto</span>
            <div className="segmented-control" role="group" aria-label="Tamanho do texto">
              {(["default", "large", "extra"] as TextSize[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={preferences.textSize === size}
                  onClick={() => update({ textSize: size })}
                >
                  {size === "default" ? "Padrão" : size === "large" ? "Maior" : "Extra"}
                </button>
              ))}
            </div>
          </div>

          <label className="preference-toggle">
            <span><strong>Leitura confortável</strong><small>Reforça contraste, foco e contornos para facilitar a leitura.</small></span>
            <input type="checkbox" checked={preferences.visual} onChange={(event) => update({ visual: event.target.checked })} />
          </label>

          <label className="preference-toggle">
            <span><strong>Reduzir estímulos</strong><small>Reduz animações, transições, movimentos decorativos, autoplay e também silencia os sons de Missões e Conquistas.</small></span>
            <input
              type="checkbox"
              checked={preferences.epilepsy}
              onChange={(event) => update({ epilepsy: event.target.checked })}
            />
          </label>

          <label className="preference-toggle">
            <span><strong>Foco e simplicidade</strong><small>Prioriza o conteúdo essencial e reduz distrações visuais sem esconder funções.</small></span>
            <input type="checkbox" checked={preferences.focus} onChange={(event) => update({ focus: event.target.checked })} />
          </label>
        </section>
      )}
    </div>
  );
}
