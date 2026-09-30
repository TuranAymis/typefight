import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeResult } from '../session/scoring';
import type { SessionRecord, SessionResult } from '../session/types';

const fixtureDirectory = fileURLToPath(new URL('../__fixtures__/', import.meta.url));
export const fixtures: readonly { name: string; record: SessionRecord; expected: SessionResult }[] =
  readdirSync(fixtureDirectory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({
      name,
      ...(JSON.parse(readFileSync(`${fixtureDirectory}/${name}`, 'utf8')) as {
        record: SessionRecord;
        expected: SessionResult;
      }),
    }));

describe('hand-verified session fixtures', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      expect(computeResult(fixture.record)).toEqual(fixture.expected);
    });
  }
});
