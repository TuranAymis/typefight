import { RECORD_VERSION, simulateDuel } from '@typefight/engine';
import type { SessionRecord } from '@typefight/engine';
import { describe, expect, it } from 'vitest';
import { ghostPosition, liveDuel, trimEvents } from './duelLive';

const TEXT = 'the quick brown fox jumps over the lazy dog while the sun sets slowly';

const typing = (msPerChar: number, startAt = 300): SessionRecord => {
  const events = [...TEXT].map((key, index) => ({ t: startAt + (index + 1) * msPerChar, key }));
  return {
    version: RECORD_VERSION,
    targetText: TEXT,
    locale: 'en',
    events,
    durationMs: (events[events.length - 1]?.t ?? 0) + 20,
  };
};

describe('liveDuel', () => {
  it('uses authoritative glitch damage and penalties at every replay cutoff', () => {
    const glitch = {
      version: 1,
      markers: [{ id: 0, charIndex: 0, wordIndex: 0, string: 'the', effect: 'overclock' as const }],
    };
    const player = { ...typing(100), glitch };
    const ghost = {
      ...typing(180),
      glitch,
      events: [{ t: 0, key: 'x' }, { t: 1, key: 'Backspace' }, ...typing(180).events],
    };
    for (const elapsedMs of [200, 800, 1500, 4000, 60000]) {
      const official = simulateDuel(player, ghost, { maxHp: 100, durationMs: elapsedMs });
      const live = liveDuel({
        targetText: TEXT,
        locale: 'en',
        events: player.events,
        elapsedMs,
        ghost,
        glitch,
      });
      expect(live.hp).toEqual({ player: official.hp.a, opponent: official.hp.b });
      expect(live.damageEvents).toEqual(official.damageEvents);
    }
  });

  it('matches the official engine result once both runs are over', () => {
    const player = typing(100);
    const ghost = typing(180);
    const official = simulateDuel(player, ghost);
    const live = liveDuel({
      targetText: TEXT,
      locale: 'en',
      events: player.events,
      elapsedMs: 60_000,
      ghost,
    });
    expect(live.hp).toEqual({ player: official.hp.a, opponent: official.hp.b });
    expect(live.damageEvents).toEqual(official.damageEvents);
  });

  it('never shows damage from the future', () => {
    const player = typing(100);
    const ghost = typing(100);
    const early = liveDuel({
      targetText: TEXT,
      locale: 'en',
      events: player.events,
      elapsedMs: 200,
      ghost,
    });
    expect(early.hp).toEqual({ player: 100, opponent: 100 });
    const mid = liveDuel({
      targetText: TEXT,
      locale: 'en',
      events: player.events,
      elapsedMs: 1500,
      ghost,
    });
    expect(mid.damageEvents.every((event) => event.t <= 1500)).toBe(true);
    expect(mid.hp.opponent).toBeLessThan(100);
  });

  it('reports a knockout and who won', () => {
    const long = Array.from({ length: 30 }, () => 'abcdefghij').join(' ');
    const fast: SessionRecord = {
      version: RECORD_VERSION,
      targetText: long,
      locale: 'en',
      events: [...long].map((key, index) => ({ t: 100 + index * 40, key })),
      durationMs: 100 + long.length * 40,
    };
    const idle: SessionRecord = { ...fast, events: [], durationMs: 60_000 };
    const live = liveDuel({
      targetText: long,
      locale: 'en',
      events: fast.events,
      elapsedMs: 60_000,
      ghost: idle,
    });
    expect(live.hp).toEqual({ player: 100, opponent: 0 });
    expect(live.koWinner).toBe('player');
    expect(live.koAt).toBeLessThan(20_000);
  });
});

describe('ghostPosition', () => {
  it('follows the real keystrokes, including corrections', () => {
    const record: SessionRecord = {
      version: RECORD_VERSION,
      targetText: 'abc',
      locale: 'en',
      events: [
        { t: 100, key: 'a' },
        { t: 200, key: 'x' },
        { t: 300, key: 'Backspace' },
        { t: 400, key: 'b' },
      ],
      durationMs: 500,
    };
    expect(ghostPosition(record, 50)).toEqual({ cursor: 0, errors: 0 });
    expect(ghostPosition(record, 250)).toEqual({ cursor: 2, errors: 1 });
    expect(ghostPosition(record, 350)).toEqual({ cursor: 1, errors: 0 });
    expect(ghostPosition(record, 1000)).toEqual({ cursor: 2, errors: 0 });
  });
});

describe('trimEvents', () => {
  it('drops keystrokes after the end of the duel', () => {
    const events = [
      { t: 10, key: 'a' },
      { t: 20, key: 'b' },
    ];
    expect(trimEvents(events, 10)).toEqual([events[0]]);
  });
});
