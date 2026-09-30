import { expect, it } from 'vitest';

it('exports only the named public runtime API', async () => {
  expect(Object.keys(await import('../index')).sort()).toMatchInlineSnapshot(`
    [
      "ENGINE_INFO",
      "RECORD_VERSION",
      "computeResult",
      "createTypingState",
      "isTypableChar",
      "isValidKey",
      "normalizeTypedText",
      "typingReducer",
    ]
  `);
});
