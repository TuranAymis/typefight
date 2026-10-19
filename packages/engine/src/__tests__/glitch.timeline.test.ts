import { describe, expect, it } from 'vitest';
import { GLITCH_CONFIG } from '@typefight/texts';
import {
  activeGlitches,
  applyGlitches,
  createRng,
  glitchFiresBetween,
  overclockWordIndices,
  placeGlitches,
  sessionGlitchFires,
  simulateDuel,
  type GlitchEffect,
  type GlitchFire,
  type SessionRecord,
} from '../index';

const text = 'surge alpha beta gamma delta';
const record = (effect: GlitchEffect = 'overclock'): SessionRecord => ({
  version: 1,
  locale: 'en',
  targetText: text,
  durationMs: 10000,
  events: [...text].map((key, index) => ({ key, t: (index + 1) * 100 })),
  glitch: { version: 1, markers: [{ id: 0, effect, wordIndex: 0, charIndex: 0, string: 'surge' }] },
});

describe('glitch timeline', () => {
  it.each(['scramble', 'blackout', 'static'] as const)(
    '%s has exact half-open duration boundaries',
    (effect) => {
      const fire: GlitchFire = { effect, t: 200, glitchId: 0, outcome: 'fired', penalty: 0 };
      const duration = GLITCH_CONFIG.durationMs[effect];
      expect(activeGlitches([fire], 199)).toEqual([]);
      expect(activeGlitches([fire], 200)).toEqual([{ fire, remainingMs: duration }]);
      expect(activeGlitches([fire], 200 + duration - 1)[0]?.remainingMs).toBe(1);
      expect(activeGlitches([fire], 200 + duration)).toEqual([]);
      expect(activeGlitches([fire], 100000)).toEqual([]);
      expect(activeGlitches([{ ...fire, outcome: 'failed' }], 200)).toEqual([]);
      expect(activeGlitches([{ ...fire, outcome: 'cooldown' }], 200)).toEqual([]);
      expect(activeGlitches([{ ...fire, effect: 'overclock' }], 200)).toEqual([]);
    },
  );

  it('boosts exactly the next three words, excluding the trigger and fourth word', () => {
    const a = record();
    const idle = { ...a, events: [] };
    expect(overclockWordIndices(a)).toEqual([1, 2, 3]);
    const actual = simulateDuel(a, idle);
    const legacy: SessionRecord = {
      version: a.version,
      targetText: a.targetText,
      locale: a.locale,
      events: a.events,
      durationMs: a.durationMs,
    };
    const normal = simulateDuel(legacy, idle);
    expect(actual.damageEvents.map((event) => event.amount)).toEqual(
      normal.damageEvents.map((event, index) =>
        index >= 1 && index <= 3 ? Math.floor(event.amount * 1.5) : event.amount,
      ),
    );
    expect(simulateDuel(idle, a).hp.a).toBe(actual.hp.b);
    expect(
      overclockWordIndices({
        ...a,
        targetText: 'surge',
        events: [...'surge'].map((key, t) => ({ key, t })),
      }),
    ).toEqual([]);
  });

  it('charges a corrected glitch mistake once, to the attacker, on completion', () => {
    const a = record('static');
    const dirty = { ...a, events: [{ key: 'x', t: 0 }, { key: 'Backspace', t: 1 }, ...a.events] };
    const idle = { ...a, events: [] };
    expect(simulateDuel(dirty, idle).hp.a).toBe(97);
    expect(simulateDuel(idle, dirty).hp.b).toBe(97);
    expect(simulateDuel(dirty, idle, { maxHp: 100, durationMs: 599 }).hp.a).toBe(100);
    expect(simulateDuel(dirty, idle, { maxHp: 100, durationMs: 600 }).hp.a).toBe(97);
  });

  it('keeps an old-style record exactly unchanged even when it contains glitch strings', () => {
    const old: SessionRecord = {
      version: 1,
      locale: 'en',
      targetText: 'surge',
      durationMs: 1000,
      events: [...'surge'].map((key, i) => ({ key, t: (i + 1) * 100 })),
    };
    expect(sessionGlitchFires(old)).toEqual([]);
    expect(simulateDuel(old, { ...old, events: [] })).toEqual({
      winner: 'a',
      reason: 'hp',
      hp: { a: 100, b: 95 },
      endedAt: 60000,
      damageEvents: [{ t: 500, amount: 5, source: 'player' }],
    });
    expect(sessionGlitchFires({ ...record(), glitch: { version: 99, markers: [] } })).toEqual([]);
  });

  it('produces identical text, markers and fires for the same text seed, with once-only replay', () => {
    const base = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda omega';
    const make = () => {
      const applied = applyGlitches(
        base,
        placeGlitches({ textId: 'text', seed: 'en:glitch-v1', targetText: base }),
      );
      const session = {
        ...record(),
        targetText: applied.text,
        events: [...applied.text].map((key, i) => ({ key, t: i * 100 })),
        glitch: { version: 1, markers: applied.markers },
      };
      return { ...applied, fires: sessionGlitchFires(session) };
    };
    expect(make()).toEqual(make());
    const { fires } = make();
    expect([
      ...glitchFiresBetween(fires, -1, 2000),
      ...glitchFiresBetween(fires, 2000, 100000),
    ]).toEqual(fires);
    expect(createRng('text', 1).next()).toBe(createRng('text', 1).next());
  });
});
