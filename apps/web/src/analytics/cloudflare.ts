export interface BeaconScript {
  readonly src: string;
  readonly beaconData: string;
}

/**
 * The Cloudflare Web Analytics script to add to the page, or null when it must not load: no token
 * configured (local dev, tests) or the player asked not to be tracked.
 */
export const cloudflareBeaconScript = (
  token: string | undefined,
  trackingAllowed: boolean,
): BeaconScript | null => {
  if (!token || !/^[0-9a-f]{32}$/.test(token) || !trackingAllowed) return null;
  return {
    src: 'https://static.cloudflareinsights.com/beacon.min.js',
    beaconData: JSON.stringify({ token }),
  };
};

export const loadCloudflareBeacon = (token: string | undefined, trackingAllowed: boolean): void => {
  const script = cloudflareBeaconScript(token, trackingAllowed);
  if (!script) return;
  const element = document.createElement('script');
  element.defer = true;
  element.src = script.src;
  element.dataset['cfBeacon'] = script.beaconData;
  document.head.append(element);
};
