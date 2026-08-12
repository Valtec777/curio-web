"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

const SOUND_PATTERNS: Record<CurioSoundName, Note[]> = {
  "mission-complete": [
    { at: 0, frequency: 523.25, duration: 0.09, volume: 0.028, type: "triangle" },
    { at: 0.085, frequency: 659.25, duration: 0.11, volume: 0.03, type: "triangle" },
    { at: 0.18, frequency: 783.99, duration: 0.16, volume: 0.034, type: "sine" },
  ],
  achievement: [
    { at: 0, frequency: 659.25, duration: 0.08, volume: 0.026, type: "triangle" },
    { at: 0.07, frequency: 830.61, duration: 0.09, volume: 0.029, type: "triangle" },
    { at: 0.14, frequency: 987.77, duration: 0.11, volume: 0.031, type: "triangle" },
    { at: 0.23, frequency: 1318.51, duration: 0.18, volume: 0.034, type: "sine" },
    { at: 0.29, frequency: 1975.53, endFrequency: 2093, duration: 0.2, volume: 0.018, type: "sine" },
  ],
};

function preferenceKey(viewerId: string) {
  return `curio:sounds:v1:${viewerId}`;
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
  gain.gain.exponentialRampToValueAtTime(note.volume ?? 0.03, peakAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(stop + 0.02);
}

export function useCurioSounds(viewerId: string) {
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);

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
    return () => {
      const context = contextRef.current;
      if (context && context.state !== "closed") void context.close();
      contextRef.current = null;
    };
  }, []);

  const getContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (contextRef.current && contextRef.current.state !== "closed") return contextRef.current;

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    const context = new AudioContextClass();
    contextRef.current = context;
    return context;
  }, []);

  const play = useCallback((sound: CurioSoundName) => {
    if (!ready || !enabled || typeof document === "undefined") return;
    if (document.documentElement.dataset.accessEpilepsy === "true") return;

    const context = getContext();
    if (!context) return;

    if (context.state === "suspended") void context.resume();
    const baseTime = context.currentTime + 0.005;
    SOUND_PATTERNS[sound].forEach((note) => createTone(context, baseTime, note));
  }, [enabled, getContext, ready]);

  const setEnabled = useCallback((next: boolean) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(preferenceKey(viewerId), next ? "on" : "off");
      window.dispatchEvent(new CustomEvent<SoundPreferenceEvent>(SOUND_EVENT, { detail: { viewerId, enabled: next } }));
    }
    setEnabledState(next);
    setReady(true);
  }, [viewerId]);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return { enabled, ready, play, setEnabled, toggle };
}
