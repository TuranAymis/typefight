import { useEffect, useRef } from 'react';
import { useAppStore, useIdentityStore } from '../store';
import { trackGameOpen } from '../analytics';
import { portal } from '../portal';
import { useSoundStore } from '../store/useSoundStore';
import { MenuScreen } from './screens/MenuScreen';
import { SimulatorScreen } from './screens/SimulatorScreen';
import { GauntletScreen } from './screens/GauntletScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { NicknameScreen } from './screens/NicknameScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { DuelScreen } from './screens/DuelScreen';
import { ErrorBoundary } from './ErrorBoundary';
import styles from './App.module.css';

export const App = () => {
  const currentScreen = useAppStore((state) => state.currentScreen);
  const restoreIdentity = useIdentityStore((state) => state.restore);
  const playerId = useIdentityStore((state) => state.identity?.playerId);
  const loadCursorEffect = useIdentityStore((state) => state.loadCursorEffect);

  useEffect(() => {
    void loadCursorEffect();
  }, [playerId, loadCursorEffect]);

  useEffect(() => {
    void restoreIdentity();
  }, [restoreIdentity]);

  useEffect(() => {
    trackGameOpen();
    // The first screen is on the page: asset loading is over.
    portal.loadingStop();
  }, []);

  const muted = useSoundStore((state) => state.muted);
  const restoreSound = useSoundStore((state) => state.restore);
  const toggleSound = useSoundStore((state) => state.toggle);
  useEffect(() => {
    void restoreSound();
  }, [restoreSound]);

  // A screen change removes the element that had focus, which strands keyboard users at the top of
  // the page. Move focus to the content area, unless the new screen already took focus itself
  // (the typing surfaces do).
  const mainRef = useRef<HTMLElement>(null);
  const shownScreen = useRef(currentScreen);
  useEffect(() => {
    // Compare with the screen already shown: this also ignores React StrictMode's repeated effect run.
    if (shownScreen.current === currentScreen) return;
    shownScreen.current = currentScreen;
    const active = document.activeElement;
    if (!active || active === document.body) mainRef.current?.focus();
  }, [currentScreen]);

  return (
    <div className={styles.appLayout}>
      <a
        href="#main-content"
        id="skip-to-content"
        className={styles.skipLink}
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to main content
      </a>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.brandLogo}>
            Type<span className={styles.brandHighlight}>Fight</span>.io
          </span>
        </div>
        <div className={styles.statusBar}>
          <button
            id="sound-toggle"
            className={styles.soundToggle}
            data-muted={muted}
            onClick={() => void toggleSound()}
          >
            {muted ? 'Sound: off' : 'Sound: on'}
          </button>
          <div>
            <span className={styles.statusIndicator}></span>
            <span>SYSTEM: SKELETON_V0.1</span>
          </div>
          <div>
            <span>CURRENT SCREEN: {currentScreen.toUpperCase()}</span>
          </div>
        </div>
      </header>

      <main id="main-content" ref={mainRef} tabIndex={-1} className={styles.mainContent}>
        <ErrorBoundary key={currentScreen}>
          {currentScreen === 'menu' && <MenuScreen />}
          {currentScreen === 'simulator' && <SimulatorScreen />}
          {currentScreen === 'gauntlet' && <GauntletScreen />}
          {currentScreen === 'results' && <ResultsScreen />}
          {currentScreen === 'nickname' && <NicknameScreen />}
          {currentScreen === 'leaderboard' && <LeaderboardScreen />}
          {currentScreen === 'profile' && <ProfileScreen />}
          {currentScreen === 'duel' && <DuelScreen />}
          {currentScreen === 'onboarding' && <OnboardingScreen />}
        </ErrorBoundary>
      </main>
    </div>
  );
};
