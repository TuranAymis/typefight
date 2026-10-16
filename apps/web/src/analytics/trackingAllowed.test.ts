import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackingAllowed } from './index';

afterEach(() => vi.unstubAllGlobals());

describe('trackingAllowed', () => {
  it('is on for a normal browser', () => {
    vi.stubGlobal('navigator', { doNotTrack: null });
    expect(trackingAllowed()).toBe(true);
    vi.stubGlobal('navigator', { doNotTrack: '0' });
    expect(trackingAllowed()).toBe(true);
  });

  it('is off when Do Not Track is on', () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' });
    expect(trackingAllowed()).toBe(false);
  });

  it('is off when Global Privacy Control is on', () => {
    vi.stubGlobal('navigator', { doNotTrack: null, globalPrivacyControl: true });
    expect(trackingAllowed()).toBe(false);
  });

  it('is off when there is no browser at all', () => {
    vi.stubGlobal('navigator', undefined);
    expect(trackingAllowed()).toBe(false);
  });
});
