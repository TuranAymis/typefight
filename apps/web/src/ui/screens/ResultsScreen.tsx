import { useAppStore } from '../../store';
import styles from './Screens.module.css';

export const ResultsScreen = () => {
  const setScreen = useAppStore((state) => state.setScreen);

  return (
    <div className={styles.screenContainer} id="screen-results">
      <span className={`${styles.badge} ${styles.badgeResults}`}>Run Analysis</span>
      <h1 className={styles.title}>Combat Results</h1>
      <p className={styles.description}>
        Session debrief, performance telemetry, and integrity breakdown.
      </p>

      <div className={styles.placeholderBox}>
        <span className={styles.placeholderCode}>[ Placeholder Screen: Telemetry inactive ]</span>
        <p className={styles.cardDesc}>
          Metrics will compute: WPM = (correct_chars / 5) / time_minutes, Accuracy = first_try_hits
          / total_hits, Score = WPM × Accuracy.
        </p>
      </div>

      <div className={styles.actionRow}>
        <button
          id="nav-results-to-menu"
          className={`${styles.button} ${styles.primaryButton}`}
          onClick={() => setScreen('menu')}
        >
          Return to Menu
        </button>
        <button
          id="nav-results-to-sim"
          className={`${styles.button} ${styles.secondaryButton}`}
          onClick={() => setScreen('simulator')}
        >
          Try Simulator
        </button>
        <button
          id="nav-results-to-gauntlet"
          className={`${styles.button} ${styles.secondaryButton}`}
          onClick={() => setScreen('gauntlet')}
        >
          Try Gauntlet
        </button>
      </div>
    </div>
  );
};
