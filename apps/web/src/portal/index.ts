import { useEffect } from 'react';
import { createPortal, type PortalGameSdk } from './portal';

/** Build mode of the CrazyGames upload (`vite build --mode crazygames`). */
export const IS_CRAZYGAMES_BUILD = import.meta.env.MODE === 'crazygames';

const sdk = (): PortalGameSdk | undefined => {
  if (!IS_CRAZYGAMES_BUILD || typeof window === 'undefined') return undefined;
  return (window as unknown as { CrazyGames?: { SDK?: { game?: PortalGameSdk } } }).CrazyGames?.SDK
    ?.game;
};

export const portal = createPortal(sdk);

/** Marks the document so portal-only CSS applies (for example no text selection on touch). */
export const markPortalDocument = (): void => {
  if (IS_CRAZYGAMES_BUILD) document.documentElement.dataset['portal'] = 'crazygames';
};

/** Tells the portal the player is playing while `active` is true (and not before or after). */
export const usePortalGameplay = (active: boolean): void => {
  useEffect(() => {
    if (!active) return;
    portal.gameplayStart();
    return () => portal.gameplayStop();
  }, [active]);
};
