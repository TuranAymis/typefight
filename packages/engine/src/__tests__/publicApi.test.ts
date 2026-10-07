import { expect, it } from 'vitest';

it('exports only the named public runtime API', async () => {
  expect(Object.keys(await import('../index')).sort()).toMatchInlineSnapshot(`
    [
      "DUEL_CONFIG",
      "ENGINE_INFO",
      "GLITCH_CONFIG",
      "RECORD_VERSION",
      "applyDamage",
      "canFireGlitch",
      "computeDamage",
      "computeResult",
      "createGlitchRng",
      "createTypingState",
      "isTypableChar",
      "isValidKey",
      "normalizeTypedText",
      "placeGlitches",
      "recordGlitchFire",
      "replayDuelWords",
      "replayGlitchFires",
      "resolveGlitchAttempt",
      "simulateDuel",
      "typingReducer",
    ]
  `);
});
