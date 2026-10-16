import type { SessionRecord } from '@typefight/engine';

export const SCENARIO_TEXT = 'the quick brown fox jumps over the lazy dog';
export const scenarioRecord = (msPerChar: number, complete = true): SessionRecord => {
  let t = 400;
  const events = [...(complete ? SCENARIO_TEXT : 'the ')].map((key, index) => {
    t += msPerChar + (index % 3) * 10;
    return { t, key };
  });
  return {
    version: 1,
    targetText: SCENARIO_TEXT,
    locale: 'en',
    events,
    durationMs: complete ? t + 1 : 60000,
  };
};

export const DUEL_SCENARIOS = [
  {
    name: 'fast player',
    player: scenarioRecord(120),
    ghost: scenarioRecord(400),
    winner: 'player',
    title: 'Victory',
    reason: 'wpm',
    hp: { a: 51, b: 51 },
    delta: 16,
  },
  {
    name: 'slow player',
    player: scenarioRecord(700, false),
    ghost: scenarioRecord(60),
    winner: 'opponent',
    title: 'Defeat',
    reason: 'hp',
    hp: { a: 51, b: 97 },
    delta: -16,
  },
] as const;
