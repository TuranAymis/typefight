/** Our own apps, shown in the ad slot whenever an ad provider has nothing to show (or is blocked). */
export interface HouseAd {
  id: string;
  name: string;
  /** One short line under the name. */
  tagline: string;
  href: string;
  /** Served from this site (public/), so the slot never makes a request to another host. */
  icon: string;
}

export const HOUSE_ADS: readonly HouseAd[] = [
  {
    id: 'vento',
    name: 'Vento',
    tagline: 'Is the weather fit for riding? Check first.',
    href: 'https://ventoride.com',
    icon: '/ventoride-icon.png',
  },
];

/** Picks one ad; `random` is injectable so the choice is testable. Undefined if there are none. */
export const pickHouseAd = (
  ads: readonly HouseAd[] = HOUSE_ADS,
  random: () => number = Math.random,
): HouseAd | undefined =>
  ads.length === 0 ? undefined : ads[Math.min(ads.length - 1, Math.floor(random() * ads.length))];
