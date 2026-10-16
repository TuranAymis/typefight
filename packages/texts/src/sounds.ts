import data from './sounds.json';

export type SoundEvent = 'key' | 'hit' | 'glitch' | 'victory' | 'defeat';

export const SOUND_EVENTS: readonly SoundEvent[] = ['key', 'hit', 'glitch', 'victory', 'defeat'];

/** One synthesized tone: a pitch glide with a short decaying envelope. */
export interface SoundTone {
  readonly wave: 'sine' | 'square' | 'sawtooth' | 'triangle';
  readonly from: number;
  readonly to: number;
  readonly durationMs: number;
  readonly gain: number;
  readonly delayMs?: number;
}

export const SOUNDS: Readonly<Record<SoundEvent, readonly SoundTone[]>> = data as Readonly<
  Record<SoundEvent, readonly SoundTone[]>
>;
