import { describe, expect, it, vi } from 'vitest';
import { createPortal, type PortalGameSdk } from './portal';

const fakeSdk = () => {
  const calls: string[] = [];
  const sdk: PortalGameSdk = {
    gameplayStart: () => calls.push('gameplayStart'),
    gameplayStop: () => calls.push('gameplayStop'),
    sdkGameLoadingStart: () => calls.push('loadingStart'),
    sdkGameLoadingStop: () => calls.push('loadingStop'),
    happytime: () => calls.push('happytime'),
  };
  return { sdk, calls };
};

describe('portal adapter', () => {
  it('forwards gameplay start and stop to the SDK', () => {
    const { sdk, calls } = fakeSdk();
    const portal = createPortal(() => sdk);
    portal.gameplayStart();
    portal.gameplayStop();
    expect(calls).toEqual(['gameplayStart', 'gameplayStop']);
  });

  it('never fires the same gameplay event twice in a row', () => {
    const { sdk, calls } = fakeSdk();
    const portal = createPortal(() => sdk);
    portal.gameplayStop(); // nothing to stop yet
    portal.gameplayStart();
    portal.gameplayStart();
    portal.gameplayStop();
    portal.gameplayStop();
    portal.gameplayStart();
    expect(calls).toEqual(['gameplayStart', 'gameplayStop', 'gameplayStart']);
  });

  it('forwards loading start and stop once per loading period', () => {
    const { sdk, calls } = fakeSdk();
    const portal = createPortal(() => sdk);
    portal.loadingStop(); // never started
    portal.loadingStart();
    portal.loadingStart();
    portal.loadingStop();
    portal.loadingStop();
    expect(calls).toEqual(['loadingStart', 'loadingStop']);
  });

  it('passes celebrations through', () => {
    const { sdk, calls } = fakeSdk();
    createPortal(() => sdk).happytime();
    expect(calls).toEqual(['happytime']);
  });

  it('does nothing and does not throw without an SDK', () => {
    const portal = createPortal(() => undefined);
    expect(() => {
      portal.loadingStart();
      portal.loadingStop();
      portal.gameplayStart();
      portal.gameplayStop();
      portal.happytime();
    }).not.toThrow();
  });

  it('reads the SDK at call time, so one that loads late is still used', () => {
    const { sdk, calls } = fakeSdk();
    const holder: { sdk?: PortalGameSdk } = {};
    const portal = createPortal(() => holder.sdk);
    portal.happytime();
    holder.sdk = sdk;
    portal.happytime();
    expect(calls).toEqual(['happytime']);
  });

  it('swallows SDK errors and rejected promises', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const portal = createPortal(() => ({
      gameplayStart: () => {
        throw new Error('sdk crashed');
      },
      gameplayStop: () => Promise.reject(new Error('ad blocker')),
      sdkGameLoadingStart: () => Promise.reject(new Error('offline')),
      sdkGameLoadingStop: () => undefined,
      happytime: () => {
        throw new Error('nope');
      },
    }));
    expect(() => {
      portal.gameplayStart();
      portal.gameplayStop();
      portal.loadingStart();
      portal.happytime();
    }).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
