import type { AnalyticsEventName, AnalyticsProps } from '@typefight/texts';
import { loadOrCreateClientId } from '../identity/clientIdStorage';
import { apiUrl } from '../apiBase';
import { createAnalytics } from './analytics';

/** Players who ask not to be tracked (Do Not Track / Global Privacy Control) send nothing at all. */
export const trackingAllowed = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigator.doNotTrack !== '1' && nav.globalPrivacyControl !== true;
};

let clientId: Promise<string | null> | undefined;

const analytics = createAnalytics({
  enabled: trackingAllowed,
  getClientId: () => (clientId ??= loadOrCreateClientId()),
  send: async (body) => {
    // keepalive lets the last batch survive the tab closing.
    await fetch(apiUrl('/api/events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
  },
  schedule: (callback, ms) => {
    const timer = window.setTimeout(callback, ms);
    return () => window.clearTimeout(timer);
  },
});

if (typeof document !== 'undefined') {
  // Send what is queued before the tab goes away.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void analytics.flush();
  });
}

/** Records a product event. Safe to call anywhere: it is a no-op when opted out and never throws. */
export const track = (name: AnalyticsEventName, props?: AnalyticsProps): void =>
  analytics.track(name, props);

let opened = false;
/** The retention signal. Once per page load, however many times React runs its effects. */
export const trackGameOpen = (): void => {
  if (opened) return;
  opened = true;
  track('game_open');
};
