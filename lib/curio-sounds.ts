export type CurioSound = "correct" | "incorrect" | "mission-complete";

export const CURIO_SOUND_KEY = "curio:experience-preferences:v1";

type StoredPreferences = { sound?: boolean };

function soundEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(CURIO_SOUND_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as StoredPreferences;
    return parsed.sound === true;
  } catch {
    return false;
  }
}

function playNote(context: AudioContext, frequency: number, start: number, duration: number, volume = 0.045) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playCurioSound(type: CurioSound) {
  if (typeof window === "undefined" || !soundEnabled()) return;

  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const now = context.currentTime + 0.01;

  if (type === "correct") {
    playNote(context, 523.25, now, 0.10);
    playNote(context, 659.25, now + 0.09, 0.12);
  } else if (type === "incorrect") {
    playNote(context, 246.94, now, 0.11, 0.032);
    playNote(context, 196.0, now + 0.10, 0.14, 0.032);
  } else {
    playNote(context, 523.25, now, 0.10);
    playNote(context, 659.25, now + 0.10, 0.11);
    playNote(context, 783.99, now + 0.21, 0.18, 0.05);
  }

  window.setTimeout(() => void context.close(), 700);
}
