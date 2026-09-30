import { useAppStore } from '../store';
import { MenuScreen } from './screens/MenuScreen';
import { SimulatorScreen } from './screens/SimulatorScreen';
import { GauntletScreen } from './screens/GauntletScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import styles from './App.module.css';

export const App = () => {
  const currentScreen = useAppStore((state) => state.currentScreen);

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
      </main>
    </div>
  );
};
