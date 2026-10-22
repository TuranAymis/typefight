/**
 * The optional ad provider (Google AdSense). It is only used when the build is given both ids; with
 * no ids the game never contacts any ad network and the slot shows one of our own apps instead.
 */
export interface AdSenseConfig {
  client: string;
  slot: string;
}

/** Valid ids only (they end up in a script URL and an attribute), and never in the portal build. */
export const adSenseConfig = (
  client: string | undefined,
  slot: string | undefined,
  portalBuild: boolean,
): AdSenseConfig | null => {
  const c = client?.trim() ?? '';
  const s = slot?.trim() ?? '';
  if (portalBuild || !/^ca-pub-\d{8,20}$/.test(c) || !/^\d{4,20}$/.test(s)) return null;
  return { client: c, slot: s };
};

/** How the provider marked the unit: filled, unfilled (no ad for this visitor) or not decided yet. */
export const fillOutcome = (status: string | null | undefined): 'filled' | 'unfilled' | 'pending' =>
  status === 'filled' ? 'filled' : status === 'unfilled' ? 'unfilled' : 'pending';

/** How long the provider gets to fill the unit before our own ad takes the slot. */
export const FILL_TIMEOUT_MS = 4000;

let scriptPromise: Promise<boolean> | undefined;

/** Loads the provider script once. Resolves false when it cannot load (ad blocker, offline, DNS). */
export const loadAdSenseScript = (client: string): Promise<boolean> =>
  (scriptPromise ??= new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  }));

/** Resolves true once the unit is filled, false if it is unfilled or nothing happens in time. */
export const watchAdFill = (unit: HTMLElement, timeoutMs = FILL_TIMEOUT_MS): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (filled: boolean) => {
      if (done) return;
      done = true;
      observer.disconnect();
      window.clearTimeout(timer);
      resolve(filled);
    };
    const check = () => {
      const outcome = fillOutcome(unit.getAttribute('data-ad-status'));
      if (outcome !== 'pending') finish(outcome === 'filled');
    };
    const observer = new MutationObserver(check);
    observer.observe(unit, { attributes: true, attributeFilter: ['data-ad-status'] });
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    check();
  });
