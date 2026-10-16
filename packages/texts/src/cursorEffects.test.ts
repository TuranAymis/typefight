import { expect, it } from 'vitest';
import { BADGES, CURSOR_EFFECTS } from './index';

it('defines a default and three unique badge rewards with complete descriptions', () => {
  expect(CURSOR_EFFECTS).toHaveLength(4);
  expect(new Set(CURSOR_EFFECTS.map(({ id }) => id)).size).toBe(4);
  expect(
    CURSOR_EFFECTS.filter(({ unlockBadgeId }) => unlockBadgeId === null).map(({ id }) => id),
  ).toEqual(['default']);
  for (const effect of CURSOR_EFFECTS) {
    expect(effect.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    expect(effect.name.trim()).not.toBe('');
    expect(effect.description.trim()).not.toBe('');
    if (effect.unlockBadgeId !== null)
      expect(BADGES.some(({ id }) => id === effect.unlockBadgeId)).toBe(true);
  }
});
