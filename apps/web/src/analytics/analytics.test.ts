import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics, type AnalyticsOptions, type QueuedEvent } from './analytics';
import { cloudflareBeaconScript } from './cloudflare';

const CLIENT = 'c'.repeat(32);

const setup = (overrides: Partial<AnalyticsOptions> = {}) => {
  const sent: { clientId: string; events: readonly QueuedEvent[] }[] = [];
  const timers: { callback: () => void; ms: number; cancelled: boolean }[] = [];
  const analytics = createAnalytics({
    enabled: () => true,
    getClientId: async () => CLIENT,
    send: async (body) => {
      sent.push(body);
    },
    schedule: (callback, ms) => {
      const timer = { callback, ms, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    ...overrides,
  });
  const fireTimers = () =>
    timers.filter((timer) => !timer.cancelled).forEach((timer) => timer.callback());
  return { analytics, sent, timers, fireTimers };
};

describe('analytics queue', () => {
  it('sends nothing until the delay passes, then one batch', async () => {
    const { analytics, sent, timers, fireTimers } = setup();
    analytics.track('game_open');
    analytics.track('sim_started', { lang: 'en' });
    expect(sent).toEqual([]);
    expect(timers).toHaveLength(1);
    expect(timers[0]?.ms).toBe(2000);
    fireTimers();
    await analytics.flush();
    expect(sent).toEqual([
      {
        clientId: CLIENT,
        events: [
          { name: 'game_open', props: {} },
          { name: 'sim_started', props: { lang: 'en' } },
        ],
      },
    ]);
  });

  it('flushes at once when enough events are waiting and cancels the timer', async () => {
    const { analytics, sent, timers } = setup({ flushAt: 3 });
    analytics.track('game_open');
    analytics.track('game_open');
    analytics.track('game_open');
    await analytics.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.events).toHaveLength(3);
    expect(timers.every((timer) => timer.cancelled)).toBe(true);
  });

  it('splits a large backlog into requests of at most 20 events', async () => {
    const { analytics, sent } = setup({ flushAt: 100, maxQueue: 100 });
    for (let i = 0; i < 45; i++) analytics.track('game_open');
    await analytics.flush();
    expect(sent.map((body) => body.events.length)).toEqual([20, 20, 5]);
  });

  it('drops events that do not match the schema instead of sending them', async () => {
    const { analytics, sent } = setup();
    analytics.track('sim_started', { lang: 'de' });
    analytics.track('sim_started', {});
    analytics.track('game_open', { nickname: 'Ada' });
    await analytics.flush();
    expect(sent).toEqual([]);
  });

  it('sends nothing when the player opted out, even if it was queued before', async () => {
    let enabled = true;
    const { analytics, sent } = setup({ enabled: () => enabled });
    analytics.track('game_open');
    enabled = false;
    analytics.track('game_open');
    await analytics.flush();
    expect(sent[0]?.events).toHaveLength(1);

    enabled = false;
    const quiet = setup({ enabled: () => false });
    quiet.analytics.track('game_open');
    await quiet.analytics.flush();
    expect(quiet.sent).toEqual([]);
  });

  it('sends nothing when the device id cannot be stored', async () => {
    const { analytics, sent } = setup({ getClientId: async () => null });
    analytics.track('game_open');
    await analytics.flush();
    expect(sent).toEqual([]);
  });

  it('survives failing sends and id lookups and keeps working afterwards', async () => {
    let fail = true;
    const { analytics, sent } = setup({
      send: async (body) => {
        if (fail) throw new Error('offline');
        sent.push(body);
      },
    });
    analytics.track('game_open');
    await expect(analytics.flush()).resolves.toBeUndefined();
    fail = false;
    analytics.track('game_open');
    await analytics.flush();
    expect(sent).toHaveLength(1);

    const broken = setup({
      getClientId: async () => {
        throw new Error('idb');
      },
    });
    broken.analytics.track('game_open');
    await expect(broken.analytics.flush()).resolves.toBeUndefined();
  });

  it('never throws from track, even when the opt-out check itself fails', () => {
    const { analytics } = setup({
      enabled: () => {
        throw new Error('boom');
      },
    });
    expect(() => analytics.track('game_open')).not.toThrow();
  });

  it('keeps only the newest events when the queue overflows', async () => {
    const { analytics, sent } = setup({ flushAt: 100, maxQueue: 3 });
    for (const lang of ['en', 'tr', 'en', 'tr', 'en'] as const)
      analytics.track('sim_started', { lang });
    await analytics.flush();
    expect(sent[0]?.events.map((event) => event.props['lang'])).toEqual(['en', 'tr', 'en']);
  });
});

describe('Cloudflare Web Analytics beacon', () => {
  const token = 'ab'.repeat(16);

  afterEach(() => vi.unstubAllGlobals());

  it('loads the official script with the site token when allowed', () => {
    expect(cloudflareBeaconScript(token, true)).toEqual({
      src: 'https://static.cloudflareinsights.com/beacon.min.js',
      beaconData: JSON.stringify({ token }),
    });
  });

  it('does not load without a token, with a malformed token or for opted-out players', () => {
    expect(cloudflareBeaconScript(undefined, true)).toBeNull();
    expect(cloudflareBeaconScript('', true)).toBeNull();
    expect(cloudflareBeaconScript('not-a-token', true)).toBeNull();
    expect(cloudflareBeaconScript(token, false)).toBeNull();
  });
});
