import { useAppStore } from '../../store';
import styles from './Screens.module.css';

export const MenuScreen = () => {
  const setScreen = useAppStore((state) => state.setScreen);

  return (
    <div className={styles.screenContainer} id="screen-menu">
      <span className={styles.badge}>Mode Selection</span>
      <h1 className={styles.title}>TypeFight.io</h1>
      <p className={styles.description}>
        Competitive keyboard combat and training. Keyboard input is your weapon.
      </p>

      <div className={styles.cardGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Simulator</span>
            <span className={styles.cardTag}>Training</span>
          </div>
          <p className={styles.cardDesc}>
            Warm-up and skill progression. Endless single-line word stream with blocking input.
          </p>
          <button
            id="nav-to-simulator"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={() => setScreen('simulator')}
          >
            Launch Simulator
          </button>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Gauntlet</span>
            <span className={styles.cardTag}>RPG Campaign</span>
          </div>
          <p className={styles.cardDesc}>
            Wave defense battle against descending words with target-locking mechanics.
          </p>
          <button
            id="nav-to-gauntlet"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={() => setScreen('gauntlet')}
          >
            Enter Gauntlet
          </button>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Results</span>
            <span className={styles.cardTag}>Analytics</span>
          </div>
          <p className={styles.cardDesc}>
            View session performance metrics, WPM, accuracy, and composite scores.
          </p>
          <button
            id="nav-to-results"
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={() => setScreen('results')}
          >
            View Results
          </button>
        </div>
      </div>
    </div>
  );
};
