/** Combo levels above this stop adding damage. */
export const MAX_COMBO_BONUS = 10;
/** Each combo level adds this many percent of the base (word length) damage. */
export const COMBO_BONUS_PERCENT = 10;

export interface DamageInput {
  /** Letters in the finished word (spaces excluded). */
  readonly wordLength: number;
  /** Combo after the word was scored. */
  readonly combo: number;
  /** True when the word was finished while staggered. */
  readonly staggered: boolean;
}

/**
 * Damage one finished word deals to the opponent. Integer math only, so the result is identical
 * on every client and on the server: base damage is the word length, scaled by
 * (100 + 10% per combo level, capped at {@link MAX_COMBO_BONUS}) and floored. Staggered words
 * deal nothing.
 */
export const computeDamage = ({ wordLength, combo, staggered }: DamageInput): number => {
  if (staggered || !Number.isFinite(wordLength) || wordLength <= 0) return 0;
  const level = Math.min(Math.max(Math.floor(combo), 0), MAX_COMBO_BONUS);
  return Math.floor((Math.floor(wordLength) * (100 + COMBO_BONUS_PERCENT * level)) / 100);
};
