import { SOUNDS, type SoundEvent } from '@typefight/texts';

/** The small slice of the Web Audio API the player needs, so tests can pass a fake. */
export interface AudioParamLike {
  setValueAtTime: (value: number, time: number) => unknown;
  exponentialRampToValueAtTime: (value: number, time: number) => unknown;
}
export interface OscillatorLike {
  type: string;
  frequency: AudioParamLike;
  connect: (node: unknown) => unknown;
  start: (time: number) => void;
  stop: (time: number) => void;
}
export interface GainLike {
  gain: AudioParamLike;
  connect: (node: unknown) => unknown;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  readonly state: string;
  resume: () => Promise<void>;
  createOscillator: () => OscillatorLike;
  createGain: () => GainLike;
}

/** Faster than this between two typing clicks and the second is dropped (it would only add noise). */
const KEY_MIN_GAP_S = 0.02;
const SILENT = 0.0001;

export interface SoundPlayer {
  play: (event: SoundEvent) => void;
}

export const createSoundPlayer = (
  createContext: () => AudioContextLike | null,
  isMuted: () => boolean,
): SoundPlayer => {
  let context: AudioContextLike | null | undefined;
  let lastKeyAt = -Infinity;

  const play = (event: SoundEvent): void => {
    if (isMuted()) return;
    try {
      // Created on the first sound: browsers only allow audio after a user gesture.
      if (context === undefined) context = createContext();
      if (!context) return;
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
      const now = context.currentTime;
      if (event === 'key') {
        if (now - lastKeyAt < KEY_MIN_GAP_S) return;
        lastKeyAt = now;
      }
      for (const tone of SOUNDS[event]) {
        const start = now + (tone.delayMs ?? 0) / 1000;
        const end = start + tone.durationMs / 1000;
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillator.type = tone.wave;
        oscillator.frequency.setValueAtTime(tone.from, start);
        oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
        envelope.gain.setValueAtTime(tone.gain, start);
        envelope.gain.exponentialRampToValueAtTime(SILENT, end);
        oscillator.connect(envelope);
        envelope.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
      }
    } catch {
      // Sound is garnish: never let it break typing or a duel.
    }
  };

  return { play };
};
