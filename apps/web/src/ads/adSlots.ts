import type { Screen } from '../store/useAppStore';

/**
 * Ad placeholders. They reserve the room a real ad unit will need so that switching ads on later
 * moves nothing. Two rules keep the game itself untouched:
 *  - an ad is never on a screen where the player types or fights (the unit would steal attention
 *    and a late load would shift the line being typed);
 *  - the portal build never has one of its own: portals sell and serve their ads through their SDK.
 */
const SCREENS_WITH_AD: ReadonlySet<Screen> = new Set(['menu', 'results', 'leaderboard', 'profile']);

/** Off unless the build turns it on (VITE_AD_PLACEHOLDERS=true), and always off in the portal build. */
export const adPlaceholdersEnabled = (raw: string | undefined, portalBuild: boolean): boolean =>
  !portalBuild && raw?.trim().toLowerCase() === 'true';

export const screenHasAd = (screen: Screen): boolean => SCREENS_WITH_AD.has(screen);
