import { SOUNDS } from '@typefight/texts';
import { describe, expect, it, vi } from 'vitest';
import { createSoundPlayer, type AudioContextLike } from './soundPlayer';

interface Recorded {
  type: string;
  from: number[];
  to: number[];
  started: number[];
  stopped: number[];
  connected: unknown[];
}

const fakeContext = (state = 'running') => {
  const oscillators: Recorded[] = [];
  const gains: { values: number[]; connectedTo: unknown[] }[] = [];
  const destination = { name: 'destination' };
  const ctx = {
    currentTime: 10,
    destination,
    state,
    resume: vi.fn(async () => undefined),
    createOscillator: () => {
      const rec: Recorded = { type: '', from: [], to: [], started: [], stopped: [], connected: [] };
      oscillators.push(rec);
      return {
        set type(value: string) {
          rec.type = value;
        },
        get type() {
          return rec.type;
        },
        frequency: {
          setValueAtTime: (value: number) => rec.from.push(value),
          exponentialRampToValueAtTime: (value: number) => rec.to.push(value),
        },
        connect: (node: unknown) => rec.connected.push(node),
        start: (time: number) => rec.started.push(time),
        stop: (time: number) => rec.stopped.push(time),
      };
    },
    createGain: () => {
      const rec = { values: [] as number[], connectedTo: [] as unknown[] };
      gains.push(rec);
      return {
        gain: {
          setValueAtTime: (value: number) => rec.values.push(value),
          exponentialRampToValueAtTime: (value: number) => rec.values.push(value),
        },
        connect: (node: unknown) => rec.connectedTo.push(node),
      };
    },
  };
  return { ctx: ctx as unknown as AudioContextLike & typeof ctx, oscillators, gains, destination };
};

describe('sound player', () => {
  it('plays nothing and never creates audio while muted', () => {
    const create = vi.fn(() => null);
    createSoundPlayer(create, () => true).play('hit');
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the audio context lazily, once', () => {
    const { ctx } = fakeContext();
    const create = vi.fn(() => ctx);
    const player = createSoundPlayer(create, () => false);
    expect(create).not.toHaveBeenCalled();
    player.play('hit');
    player.play('hit');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('schedules one glide per tone with the pitch, delay and envelope from the content', () => {
    const { ctx, oscillators, gains } = fakeContext();
    createSoundPlayer(
      () => ctx,
      () => false,
    ).play('victory');
    const tones = SOUNDS.victory;
    expect(oscillators).toHaveLength(tones.length);
    tones.forEach((tone, index) => {
      const osc = oscillators[index];
      const start = 10 + (tone.delayMs ?? 0) / 1000;
      const end = start + tone.durationMs / 1000;
      expect(osc?.type).toBe(tone.wave);
      expect(osc?.from).toEqual([tone.from]);
      expect(osc?.to).toEqual([tone.to]);
      expect(osc?.started).toEqual([start]);
      expect(osc?.stopped[0]).toBeGreaterThan(end);
      expect(gains[index]?.values[0]).toBe(tone.gain);
      expect(gains[index]?.values[1]).toBeGreaterThan(0);
    });
  });

  it('wires oscillator -> gain -> output for every tone', () => {
    const { ctx, oscillators, gains, destination } = fakeContext();
    createSoundPlayer(
      () => ctx,
      () => false,
    ).play('glitch');
    expect(oscillators).toHaveLength(SOUNDS.glitch.length);
    for (const osc of oscillators) expect(osc.connected).toHaveLength(1);
    for (const gain of gains) expect(gain.connectedTo).toEqual([destination]);
  });

  it('resumes a context the browser suspended', () => {
    const { ctx } = fakeContext('suspended');
    createSoundPlayer(
      () => ctx,
      () => false,
    ).play('key');
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('drops a typing click that follows another within the minimum gap', () => {
    const { ctx, oscillators } = fakeContext();
    const player = createSoundPlayer(
      () => ctx,
      () => false,
    );
    player.play('key');
    player.play('key');
    expect(oscillators).toHaveLength(SOUNDS.key.length);
    (ctx as { currentTime: number }).currentTime = 10.05;
    player.play('key');
    expect(oscillators).toHaveLength(SOUNDS.key.length * 2);
  });

  it('honours the mute setting at the moment of each call', () => {
    const { ctx, oscillators } = fakeContext();
    let muted = false;
    const player = createSoundPlayer(
      () => ctx,
      () => muted,
    );
    player.play('hit');
    const afterFirst = oscillators.length;
    muted = true;
    player.play('hit');
    expect(oscillators).toHaveLength(afterFirst);
    muted = false;
    player.play('hit');
    expect(oscillators.length).toBeGreaterThan(afterFirst);
  });

  it('survives a missing Web Audio API and a failing context', () => {
    expect(() =>
      createSoundPlayer(
        () => null,
        () => false,
      ).play('hit'),
    ).not.toThrow();
    expect(() =>
      createSoundPlayer(
        () => {
          throw new Error('blocked');
        },
        () => false,
      ).play('hit'),
    ).not.toThrow();
  });
});
