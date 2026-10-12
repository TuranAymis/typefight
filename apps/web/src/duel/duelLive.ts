import { RECORD_VERSION, simulateDuel } from '@typefight/engine';
import type { DamageEvent, KeyEvent, Locale, SessionRecord } from '@typefight/engine';

export const DUEL_DURATION_MS = 60_000;
export const COUNTDOWN_SECONDS = 3;
export const MAX_HP = 100;

export interface LiveDuel {
  readonly hp: { readonly player: number; readonly opponent: number };
  /** Set once somebody is knocked out; the duel is over at that moment. */
  readonly koAt: number | null;
  readonly koWinner: 'player' | 'opponent' | 'draw' | null;
  readonly damageEvents: readonly DamageEvent[];
}

/**
 * HP of both fighters after `elapsedMs`, from the same engine function the server uses. Both
 * records are cut at `elapsedMs`, so nobody sees damage from the future.
 */
export const liveDuel = (input: {
  readonly targetText: string;
  readonly locale: Locale;
  readonly events: readonly KeyEvent[];
  readonly elapsedMs: number;
  readonly ghost: SessionRecord;
}): LiveDuel => {
  const elapsed = Math.min(Math.max(input.elapsedMs, 1), DUEL_DURATION_MS);
  const player: SessionRecord = {
    version: RECORD_VERSION,
    targetText: input.targetText,
    locale: input.locale,
    events: input.events.filter((event) => event.t <= elapsed),
    durationMs: elapsed,
  };
  const result = simulateDuel(player, input.ghost, { maxHp: MAX_HP, durationMs: elapsed });
  const knockedOut = result.hp.a === 0 || result.hp.b === 0;
  const winner = result.winner === 'a' ? 'player' : result.winner === 'b' ? 'opponent' : 'draw';
  return {
    hp: { player: result.hp.a, opponent: result.hp.b },
    koAt: knockedOut ? result.endedAt : null,
    koWinner: knockedOut ? winner : null,
    damageEvents: result.damageEvents,
  };
};

export interface GhostPosition {
  /** The ghost's cursor index in the target text. */
  readonly cursor: number;
  readonly errors: number;
}

/** Where the ghost cursor is at time `t`, replaying its real keystrokes including corrections. */
export const ghostPosition = (record: SessionRecord, t: number): GhostPosition => {
  const typed: string[] = [];
  for (const event of record.events) {
    if (event.t > t) break;
    if (event.key === 'Backspace') typed.pop();
    else if (event.key.length === 1 && typed.length < record.targetText.length) {
      typed.push(event.key);
    }
  }
  const errors = typed.filter((char, index) => char !== record.targetText[index]).length;
  return { cursor: typed.length, errors };
};

/** The keystrokes that count for the submitted record, cut at the moment the duel ended. */
export const trimEvents = (events: readonly KeyEvent[], endsAt: number): KeyEvent[] =>
  events.filter((event) => event.t <= endsAt);
