import { describe, expect, it } from 'vitest';
import type { Screen } from '../store/useAppStore';
import { adPlaceholdersEnabled, screenHasAd } from './adSlots';

describe('adPlaceholdersEnabled', () => {
  it('is off unless the build asks for it', () => {
    expect(adPlaceholdersEnabled(undefined, false)).toBe(false);
    expect(adPlaceholdersEnabled('', false)).toBe(false);
    expect(adPlaceholdersEnabled('false', false)).toBe(false);
    expect(adPlaceholdersEnabled('1', false)).toBe(false);
    expect(adPlaceholdersEnabled('true', false)).toBe(true);
    expect(adPlaceholdersEnabled(' TRUE ', false)).toBe(true);
  });

  it('is never on in the portal build', () => {
    expect(adPlaceholdersEnabled('true', true)).toBe(false);
  });
});

describe('screenHasAd', () => {
  it('keeps ads off every screen where the player types or fights', () => {
    for (const screen of ['simulator', 'gauntlet', 'duel', 'onboarding', 'nickname'] as Screen[])
      expect(screenHasAd(screen), screen).toBe(false);
  });

  it('allows them on the calm screens', () => {
    for (const screen of ['menu', 'results', 'leaderboard', 'profile'] as Screen[])
      expect(screenHasAd(screen), screen).toBe(true);
  });
});
