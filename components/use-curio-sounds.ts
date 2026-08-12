"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CurioSoundName = "tap" | "step" | "discover" | "success" | "celebrate";

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
  tap: [
    { at: 0, frequency: 620, endFrequency: 760, duration: 0.055, volume: 0.025, type: "sine" },
  ],
  step: [
    { at: 0, frequency: 440, endFrequency: 520, duration: 0.07, volume: 0.026, type: "triangle" },
    { at: 0.055, frequency: 660, endFrequency: 740, duration: 0.08, volume: 0.023, type: "sine" },
  ],
  discover: [
    { at: 0, frequency: 523.25, duration: 0.09, volume: 0.025, type: "sine" },
    { at: 0.075, frequency: 659.25, duration: 0.1, volume: 0.027, type: "sine" },
    { at: 0.15, frequency: 783.99, duration: 0.13, volume: 0.03, type: "triangle" },
  ],
  success: [
    { at: 0, frequency: 659.25, duration: 0.09, volume: 0.028, type: "triangle" },
    { at: 0.08, frequency: 880, duration: 0.15, volume: 0.032, type: "sine" },
  ],
  celebrate: [
    { at: 0, frequency: 523.25, duration: 0.09, volume: 0.03, type: "triangle" },
    { at: 0.075, frequency: 659.25, duration: 0.09, volume: 0.032, type: "triangle" },
    { at: 0.15, frequency: 783.99, duration: 0.1, volume: 0.034, type: "triangle" },
    { at: 0.23, frequency: 1046.5, duration: 0.12, volume: 0.037, type: "sine" },
    { at: 0.34, frequency: 1318.51, duration: 0.2, volume: 0.032, type: "sine" },
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
  const [enabled, setEnabledState] = useState(true);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabledState(window.localStorage.getItem(preferenceKey(viewerId)) !== "off");

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
    if (!enabled) return;
    const context = getContext();
    if (!context) return;

    if (context.state === "suspended") void context.resume();
    const baseTime = context.currentTime + 0.005;
    SOUND_PATTERNS[sound].forEach((note) => createTone(context, baseTime, note));
  }, [enabled, getContext]);

  const setEnabled = useCallback((next: boolean) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(preferenceKey(viewerId), next ? "on" : "off");
      window.dispatchEvent(new CustomEvent<SoundPreferenceEvent>(SOUND_EVENT, { detail: { viewerId, enabled: next } }));
    }
    setEnabledState(next);
  }, [viewerId]);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return { enabled, play, setEnabled, toggle };
}
