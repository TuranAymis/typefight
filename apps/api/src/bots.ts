import { glitchForText } from './duelText';
import { computeResult, RECORD_VERSION } from '@typefight/engine';
import type { SessionRecord } from '@typefight/engine';
import type { TextPassage } from '@typefight/texts';
import { sha256Hex } from './crypto';

/** Cold-start opponents so a duel is never empty. Always labelled as bots, never hidden. */
export const BOT_WPM_LEVELS = [30, 50, 70, 90, 120, 150] as const;
export type BotLevel = (typeof BOT_WPM_LEVELS)[number];

/** Rating assigned to each bot level so matchmaking can treat them like any other opponent. */
export const BOT_RATINGS: Readonly<Record<BotLevel, number>> = {
  30: 700,
  50: 850,
  70: 1000,
  90: 1150,
  120: 1300,
  150: 1450,
};

export const botPlayerId = (level: BotLevel): string => `bot-${level}`;
export const botSessionId = (level: BotLevel, textId: string): string => `bot-${level}-${textId}`;
export const botNickname = (level: BotLevel): string => `[BOT] ${level} WPM`;

const START_DELAY_MS = 300;

/**
 * Deterministic typing record at roughly `level` WPM (5 chars per word): the same level and text
 * always give the same record. Intervals vary by +-20% so the rhythm looks plausible.
 */
export const generateBotRecord = (passage: TextPassage, level: BotLevel): SessionRecord => {
  const meanInterval = 12000 / level;
  let t = START_DELAY_MS;
  const events = [...passage.text].map((key, index) => {
    const jitter = 0.8 + ((index * 37 + level) % 41) / 100;
    t += meanInterval * jitter;
    return { t: Math.round(t), key };
  });
  const glitch = glitchForText(passage.id, passage.text, passage.lang);
  return {
    ...(glitch ? { glitch } : {}),
    version: RECORD_VERSION,
    targetText: passage.text,
    locale: passage.lang,
    events,
    durationMs: (events[events.length - 1]?.t ?? 0) + 50,
  };
};

/** Picks the bot level closest to the player's expected speed. */
export const nearestBotLevel = (expectedWpm: number): BotLevel => {
  let best: BotLevel = BOT_WPM_LEVELS[0];
  for (const level of BOT_WPM_LEVELS) {
    if (Math.abs(level - expectedWpm) < Math.abs(best - expectedWpm)) best = level;
  }
  return best;
};

/** Creates the bot player and its session for this text if missing (idempotent). */
export const ensureBotSession = async (
  db: D1Database,
  now: number,
  level: BotLevel,
  passage: TextPassage,
): Promise<string> => {
  const sessionId = botSessionId(level, passage.id);
  const record = generateBotRecord(passage, level);
  const result = computeResult(record);
  await db
    .prepare(
      `INSERT OR IGNORE INTO players (id, nickname, token_hash, is_bot, rating, created_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      botPlayerId(level),
      botNickname(level),
      await sha256Hex(`bot:${level}`),
      BOT_RATINGS[level],
      now,
    )
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO sessions (id, player_id, mode, lang, text_id, target_text, seed, token_hash,
         status, started_at, submitted_at, duration_ms, wpm, raw_wpm, accuracy, consistency, record_json, verified)
       VALUES (?, ?, 'duel', ?, ?, ?, 0, 'bot', 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .bind(
      sessionId,
      botPlayerId(level),
      passage.lang,
      passage.id,
      passage.text,
      now,
      now,
      record.durationMs,
      result.wpm,
      result.rawWpm,
      result.accuracy,
      result.consistency,
      JSON.stringify(record),
    )
    .run();
  return sessionId;
};
