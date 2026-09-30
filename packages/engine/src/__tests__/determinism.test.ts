import { expect, it } from 'vitest';
import { computeResult } from '../session/scoring';
import { fixtures } from './fixtures.test';

const deepFreeze = (value: object): void => {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') deepFreeze(child);
  }
  Object.freeze(value);
};

it('replays every fixture identically 200 times, including frozen input', () => {
  for (const { record } of fixtures) {
    const baseline = JSON.stringify(computeResult(record));
    deepFreeze(record);
    for (let iteration = 0; iteration < 200; iteration += 1) {
      const result = computeResult(record);
      expect(JSON.stringify(result)).toBe(baseline);
      for (const value of Object.values(result)) expect(Number.isFinite(value)).toBe(true);
    }
  }
});
