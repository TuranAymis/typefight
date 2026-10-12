export const INITIAL_RATING = 1000;
export const K_FACTOR = 32;
export const MIN_RATING = 100;

export type DuelScore = 'a' | 'b' | 'draw';

export interface RatingUpdate {
  readonly a: number;
  readonly b: number;
  /** Rating change of player a; b changes by the opposite amount before the floor is applied. */
  readonly delta: number;
}

/** Probability that a player rated `ratingA` beats one rated `ratingB`. */
export const expectedScore = (ratingA: number, ratingB: number): number =>
  1 / (1 + 10 ** ((ratingB - ratingA) / 400));

const scoreOf = (winner: DuelScore): number => (winner === 'a' ? 1 : winner === 'b' ? 0 : 0.5);

/**
 * Standard Elo with integer ratings. The delta is rounded once and applied with opposite signs,
 * so the rating pool stays constant except where the MIN_RATING floor kicks in.
 */
export const updateRatings = (
  ratingA: number,
  ratingB: number,
  winner: DuelScore,
  k: number = K_FACTOR,
): RatingUpdate => {
  const delta = Math.round(k * (scoreOf(winner) - expectedScore(ratingA, ratingB)));
  return {
    a: Math.max(MIN_RATING, ratingA + delta),
    b: Math.max(MIN_RATING, ratingB - delta),
    delta,
  };
};
