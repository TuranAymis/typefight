import type { Page } from '@playwright/test';

export type SoundName = 'key' | 'hit' | 'glitch' | 'victory' | 'defeat';

/** Each cue starts with a tone that no other cue starts with, so the first tone identifies it. */
const FIRST_TONE: Record<SoundName, { wave: string; from: number }> = {
  key: { wave: 'square', from: 880 },
  hit: { wave: 'sawtooth', from: 240 },
  glitch: { wave: 'square', from: 1400 },
  victory: { wave: 'triangle', from: 523.25 },
  defeat: { wave: 'sawtooth', from: 392 },
};

/** Replaces Web Audio with a recorder so tests can see which cues play. Call before page.goto. */
export const installFakeAudio = async (page: Page) => {
  await page.addInitScript(() => {
    const played: { wave: string; from: number }[] = [];
    (window as unknown as { __played: typeof played }).__played = played;
    class FakeAudioContext {
      state = 'running';
      destination = {};
      get currentTime() {
        return performance.now() / 1000;
      }
      resume() {
        return Promise.resolve();
      }
      createGain() {
        const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
        return { gain: param, connect() {} };
      }
      createOscillator() {
        const osc = {
          type: 'sine',
          frequency: {
            setValueAtTime: (value: number) => {
              played.push({ wave: osc.type, from: value });
            },
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          start() {},
          stop() {},
        };
        return osc;
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  });
};

/** Names of the cues played so far, in order (only the first tone of each cue is counted). */
export const playedSounds = async (page: Page): Promise<SoundName[]> => {
  const tones = await page.evaluate(
    () => (window as unknown as { __played: { wave: string; from: number }[] }).__played,
  );
  const names = Object.keys(FIRST_TONE) as SoundName[];
  return tones.flatMap((tone) => {
    const name = names.find(
      (candidate) =>
        FIRST_TONE[candidate].wave === tone.wave && FIRST_TONE[candidate].from === tone.from,
    );
    return name ? [name] : [];
  });
};
