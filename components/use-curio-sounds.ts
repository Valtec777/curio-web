"use client";

import { useCallback, useEffect, useState } from "react";

export type CurioSoundName = "mission-complete" | "achievement";

type Note = {
  at: number;
  frequency: number;
  duration: number;
  volume?: number;
  type?: OscillatorType;
  endFrequency?: number;
};

type SoundPreferenceEvent = {
  viewerId: string;
  enabled: boolean;
};

const SOUND_EVENT = "curio:sound-preference";
let sharedAudioContext: AudioContext | null = null;

const SOUND_PATTERNS: Record<CurioSoundName, Note[]> = {
  "mission-complete": [
    { at: 0, frequency: 523.25, duration: 0.1, volume: 0.052, type: "triangle" },
    { at: 0.09, frequency: 659.25, duration: 0.12, volume: 0.06, type: "triangle" },
    { at: 0.19, frequency: 783.99, duration: 0.18, volume: 0.068, type: "sine" },
  ],
  achievement: [
    { at: 0, frequency: 659.25, duration: 0.09, volume: 0.048, type: "triangle" },
    { at: 0.075, frequency: 830.61, duration: 0.1, volume: 0.055, type: "triangle" },
    { at: 0.15, frequency: 987.77, duration: 0.12, volume: 0.062, type: "triangle" },
    { at: 0.245, frequency: 1318.51, duration: 0.2, volume: 0.07, type: "sine" },
    { at: 0.31, frequency: 1975.53, endFrequency: 2093, duration: 0.22, volume: 0.038, type: "sine" },
  ],
};

function preferenceKey(viewerId: string) {
  return `curio:sounds:v1:${viewerId}`;
}

function reducedStimuliEnabled() {
  return typeof document !== "undefined" && document.documentElement.dataset.accessEpilepsy === "true";
}

function getSharedContext() {
  if (typeof window === "undefined") return null;
  if (sharedAudioContext && sharedAudioContext.state !== "closed") return sharedAudioContext;

  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  sharedAudioContext = new AudioContextClass();
  return sharedAudioContext;
}

async function resumeContext(context: AudioContext) {
  if (context.state === "running") return true;
  if (context.state === "closed") return false;

  try {
    await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

function createTone(context: AudioContext, baseTime: number, note: Note) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = baseTime + note.at;
  const peakAt = start + Math.min(0.014, note.duration / 3);
  const stop = start + note.duration;

  oscillator.type = note.type ?? "sine";
  oscillator.frequency.setValueAtTime(note.frequency, start);
  if (note.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency, stop);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(note.volume ?? 0.055, peakAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(stop + 0.02);
}

export function useCurioSounds(viewerId: string) {
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabledState(window.localStorage.getItem(preferenceKey(viewerId)) !== "off");
    setReady(true);

    const onPreference = (event: Event) => {
      const detail = (event as CustomEvent<SoundPreferenceEvent>).detail;
      if (detail?.viewerId === viewerId) setEnabledState(detail.enabled);
    };

    window.addEventListener(SOUND_EVENT, onPreference);
    return () => window.removeEventListener(SOUND_EVENT, onPreference);
  }, [viewerId]);

  useEffect(() => {
    if (!ready || !enabled || typeof window === "undefined") return;

    const unlock = () => {
      if (reducedStimuliEnabled()) return;
      const context = getSharedContext();
      if (context && context.state !== "running") void resumeContext(context);
    };

    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    window.addEventListener("touchstart", unlock, true);

    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("touchstart", unlock, true);
    };
  }, [enabled, ready]);

  const play = useCallback(async (sound: CurioSoundName) => {
    if (!ready || !enabled || reducedStimuliEnabled()) return false;

    const context = getSharedContext();
    if (!context) return false;

    const running = await resumeContext(context);
    if (!running) return false;

    const baseTime = context.currentTime + 0.008;
    SOUND_PATTERNS[sound].forEach((note) => createTone(context, baseTime, note));
    return true;
  }, [enabled, ready]);

  const setEnabled = useCallback((next: boolean) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(preferenceKey(viewerId), next ? "on" : "off");
      window.dispatchEvent(new CustomEvent<SoundPreferenceEvent>(SOUND_EVENT, { detail: { viewerId, enabled: next } }));

      if (next && !reducedStimuliEnabled()) {
        const context = getSharedContext();
        if (context) void resumeContext(context);
      }
    }
    setEnabledState(next);
    setReady(true);
  }, [viewerId]);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return { enabled, ready, play, setEnabled, toggle };
}
