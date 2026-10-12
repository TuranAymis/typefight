import { expect, it } from 'vitest';

it('exports only the named public runtime API', async () => {
  expect(Object.keys(await import('../index')).sort()).toMatchInlineSnapshot(`
    [
      "COMBO_BONUS_PERCENT",
      "DEFAULT_DUEL_CONFIG",
      "DEFAULT_GLITCH_RULES",
      "ENGINE_INFO",
      "GLITCH_POOL",
      "MAX_COMBO_BONUS",
      "RECORD_VERSION",
      "STAGGER_MS",
      "applyGlitches",
      "computeComboTimeline",
      "computeDamage",
      "computeResult",
      "createRng",
      "createTypingState",
      "glitchFiresBetween",
      "isTypableChar",
      "isValidKey",
      "normalizeTypedText",
      "placeGlitches",
      "recordGlitchFires",
      "simulateDuel",
      "typingReducer",
    ]
  `);
});
