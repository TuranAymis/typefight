import { getEffectiveMotion, useAppStore, type MotionSetting } from '../store/useAppStore';
import { useReducedMotion } from './hooks/useReducedMotion';
import { MenuScreen } from './screens/MenuScreen';
import { SimulatorScreen } from './screens/SimulatorScreen';
import { GauntletScreen } from './screens/GauntletScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import styles from './App.module.css';

export const App = () => {
  const currentScreen = useAppStore((state) => state.currentScreen);
  const motionSetting = useAppStore((state) => state.motionSetting);
  const setMotionSetting = useAppStore((state) => state.setMotionSetting);
  const systemReduced = useReducedMotion();
  const effectiveMotion = getEffectiveMotion(motionSetting, systemReduced);

  return (
    <div className={styles.appLayout} data-motion={effectiveMotion}>
      <header className={styles.topBar}>
        <div className={styles.brandLogo}>
          Type<span className={styles.brandHighlight}>Fight</span>.io
        </div>
        <div className={styles.statusBar}>
          <div>
            <span className={styles.statusIndicator} aria-hidden="true" />
            SYSTEM: SKELETON_V0.1
          </div>
          <div>CURRENT SCREEN: {currentScreen.toUpperCase()}</div>
          <label className={styles.motionControl}>
            Motion
            <select
              className={styles.motionSelect}
              aria-label="Motion setting"
              value={motionSetting}
              onChange={(event) => setMotionSetting(event.target.value as MotionSetting)}
            >
              <option value="system">System</option>
              <option value="reduced">Reduced</option>
              <option value="full">Full</option>
            </select>
          </label>
        </div>
      </header>
      <main className={styles.mainContent} id="main-content">
        {currentScreen === 'menu' && <MenuScreen />}
        {currentScreen === 'simulator' && <SimulatorScreen />}
        {currentScreen === 'gauntlet' && <GauntletScreen />}
        {currentScreen === 'results' && <ResultsScreen />}
      </main>
    </div>
  );
};
