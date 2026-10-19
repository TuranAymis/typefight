/** Checked against the engine in API tests; browser mocks cannot invent a different HP result. */
export const OVERCLOCK_SCENARIO = {
  text: 'noise alpha beta gamma delta epsilon zeta eta theta omega',
  playerKeys: 'noise alpha beta gamma ',
  ghostKeys: 'noise alpha beta gamma delta ',
  outcome: { winner: 'b', reason: 'hp', hp: { a: 62, b: 69 }, endedAt: 60000 },
} as const;
