import { useEffect } from 'react';
import { useAppStore, useIdentityStore } from '../store';
import { MenuScreen } from './screens/MenuScreen';
import { SimulatorScreen } from './screens/SimulatorScreen';
import { GauntletScreen } from './screens/GauntletScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { NicknameScreen } from './screens/NicknameScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import styles from './App.module.css';

export const App = () => {
  const currentScreen = useAppStore((state) => state.currentScreen);
  const restoreIdentity = useIdentityStore((state) => state.restore);

  useEffect(() => {
    void restoreIdentity();
  }, [restoreIdentity]);

  return (
    <div className={styles.appLayout}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.brandLogo}>
            Type<span className={styles.brandHighlight}>Fight</span>.io
          </span>
        </div>
        <div className={styles.statusBar}>
          <div>
            <span className={styles.statusIndicator}></span>
            <span>SYSTEM: SKELETON_V0.1</span>
          </div>
          <div>
            <span>CURRENT SCREEN: {currentScreen.toUpperCase()}</span>
          </div>
        </div>
      </header>

      <main className={styles.mainContent}>
        {currentScreen === 'menu' && <MenuScreen />}
        {currentScreen === 'simulator' && <SimulatorScreen />}
        {currentScreen === 'gauntlet' && <GauntletScreen />}
        {currentScreen === 'results' && <ResultsScreen />}
        {currentScreen === 'nickname' && <NicknameScreen />}
        {currentScreen === 'leaderboard' && <LeaderboardScreen />}
        {currentScreen === 'profile' && <ProfileScreen />}
      </main>
    </div>
  );
};
