import { describe, expect, it } from 'vitest';
import { SOUNDS, SOUND_EVENTS } from './sounds';

const lengthMs = (event: (typeof SOUND_EVENTS)[number]) =>
  Math.max(...SOUNDS[event].map((tone) => (tone.delayMs ?? 0) + tone.durationMs));

describe('sound content', () => {
  it('defines every game event and nothing else', () => {
    expect(Object.keys(SOUNDS).sort()).toEqual([...SOUND_EVENTS].sort());
  });

  it('keeps every tone inside safe, audible ranges', () => {
    for (const event of SOUND_EVENTS) {
      expect(SOUNDS[event].length).toBeGreaterThan(0);
      for (const tone of SOUNDS[event]) {
        expect(['sine', 'square', 'sawtooth', 'triangle']).toContain(tone.wave);
        expect(tone.from).toBeGreaterThanOrEqual(40);
        expect(tone.from).toBeLessThanOrEqual(5000);
        expect(tone.to).toBeGreaterThanOrEqual(40);
        expect(tone.to).toBeLessThanOrEqual(5000);
        expect(tone.durationMs).toBeGreaterThan(0);
        expect(tone.gain).toBeGreaterThan(0);
        expect(tone.gain).toBeLessThanOrEqual(0.2);
        expect(tone.delayMs ?? 0).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps the typing click short and the other cues under two seconds', () => {
    expect(lengthMs('key')).toBeLessThanOrEqual(60);
    for (const event of SOUND_EVENTS) expect(lengthMs(event)).toBeLessThanOrEqual(2000);
  });

  it('makes the key click much quieter than a hit so fast typing is not harsh', () => {
    const peak = (event: (typeof SOUND_EVENTS)[number]) =>
      Math.max(...SOUNDS[event].map((tone) => tone.gain));
    expect(peak('key')).toBeLessThan(peak('hit') / 2);
  });
});
