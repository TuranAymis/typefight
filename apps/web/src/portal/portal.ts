/** The slice of the CrazyGames SDK v2 `game` module the game uses. */
export interface PortalGameSdk {
  gameplayStart: () => unknown;
  gameplayStop: () => unknown;
  sdkGameLoadingStart: () => unknown;
  sdkGameLoadingStop: () => unknown;
  happytime: () => unknown;
}

export interface Portal {
  /** Asset loading began / ended (measured by the portal). */
  loadingStart: () => void;
  loadingStop: () => void;
  /** The player is actively playing / has stopped (menu, result, pause). Never fires twice in a row. */
  gameplayStart: () => void;
  gameplayStop: () => void;
  /** A celebration moment (a duel win). Use sparingly. */
  happytime: () => void;
}

const swallow = (call: () => unknown): void => {
  try {
    const result = call();
    // The SDK returns promises; a rejected one (ad blocker, offline) must never surface.
    if (result instanceof Promise) result.catch(() => undefined);
  } catch {
    // The portal SDK is optional garnish for the game itself.
  }
};

/**
 * Wraps the portal SDK. `getSdk` is read at call time because the SDK script may finish loading after
 * the game starts. With no SDK (normal site, SDK blocked) every call does nothing.
 */
export const createPortal = (getSdk: () => PortalGameSdk | undefined): Portal => {
  let playing = false;
  let loading = false;
  return {
    loadingStart: () => {
      if (loading) return;
      loading = true;
      swallow(() => getSdk()?.sdkGameLoadingStart());
    },
    loadingStop: () => {
      if (!loading) return;
      loading = false;
      swallow(() => getSdk()?.sdkGameLoadingStop());
    },
    gameplayStart: () => {
      if (playing) return;
      playing = true;
      swallow(() => getSdk()?.gameplayStart());
    },
    gameplayStop: () => {
      if (!playing) return;
      playing = false;
      swallow(() => getSdk()?.gameplayStop());
    },
    happytime: () => swallow(() => getSdk()?.happytime()),
  };
};
