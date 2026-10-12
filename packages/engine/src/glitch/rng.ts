export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, bound). Returns 0 for a non-positive bound. */
  int(bound: number): number;
}

/** FNV-1a over UTF-16 code units: stable string -> uint32 seed. */
const hashSeed = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/**
 * mulberry32 seeded from `textId` + `seed`. Integer arithmetic only, so the sequence is identical
 * in every JS runtime (browser, workerd, Node) and client and server place glitches identically.
 */
export const createRng = (textId: string, seed: number | string): Rng => {
  let state = hashSeed(`${textId}\u0000${seed}`);
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (bound) => (bound > 0 ? Math.floor(next() * bound) : 0),
  };
};
