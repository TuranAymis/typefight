import { describe, expect, it } from 'vitest';
import { adSenseConfig, fillOutcome } from './adProvider';
import { HOUSE_ADS, pickHouseAd } from './houseAds';

describe('house ads', () => {
  it('lists Vento with an https link and a local icon', () => {
    const vento = HOUSE_ADS.find((ad) => ad.id === 'vento');
    expect(vento?.href).toBe('https://ventoride.com');
    expect(vento?.icon.startsWith('/')).toBe(true);
  });

  it('picks within range and handles an empty list', () => {
    const ads = [HOUSE_ADS[0]!, { ...HOUSE_ADS[0]!, id: 'b' }];
    expect(pickHouseAd(ads, () => 0)?.id).toBe('vento');
    expect(pickHouseAd(ads, () => 0.99)?.id).toBe('b');
    expect(pickHouseAd(ads, () => 1)?.id).toBe('b');
    expect(pickHouseAd([])).toBeUndefined();
  });
});

describe('ad provider config', () => {
  it('needs both valid ids', () => {
    expect(adSenseConfig('ca-pub-1234567890123456', '1234567890', false)).toEqual({
      client: 'ca-pub-1234567890123456',
      slot: '1234567890',
    });
    expect(adSenseConfig(undefined, '1234567890', false)).toBeNull();
    expect(adSenseConfig('ca-pub-1234567890123456', undefined, false)).toBeNull();
    expect(adSenseConfig('ca-pub-1"><script>', '1234567890', false)).toBeNull();
    expect(adSenseConfig('ca-pub-1234567890123456', '12ab', false)).toBeNull();
  });

  it('is never used in the portal build', () => {
    expect(adSenseConfig('ca-pub-1234567890123456', '1234567890', true)).toBeNull();
  });

  it('reads the provider fill status', () => {
    expect(fillOutcome('filled')).toBe('filled');
    expect(fillOutcome('unfilled')).toBe('unfilled');
    expect(fillOutcome(null)).toBe('pending');
    expect(fillOutcome(undefined)).toBe('pending');
  });
});
