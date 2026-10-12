import { useAppStore } from '../../store';
import { Button, Panel } from '../components';
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
        <Panel className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Simulator</span>
            <span className={styles.cardTag}>Training</span>
          </div>
          <p className={styles.cardDesc}>
            Warm-up and skill progression. Endless single-line word stream with blocking input.
          </p>
          <Button id="nav-to-simulator" onClick={() => setScreen('simulator')}>
            Launch Simulator
          </Button>
        </Panel>

        <Panel className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Gauntlet</span>
            <span className={styles.cardTag}>RPG Campaign</span>
          </div>
          <p className={styles.cardDesc}>
            Wave defense battle against descending words with target-locking mechanics.
          </p>
          <Button id="nav-to-gauntlet" onClick={() => setScreen('gauntlet')}>
            Enter Gauntlet
          </Button>
        </Panel>

        <Panel className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Results</span>
            <span className={styles.cardTag}>Analytics</span>
          </div>
          <p className={styles.cardDesc}>
            View session performance metrics, WPM, accuracy, and composite scores.
          </p>
          <Button id="nav-to-results" variant="secondary" onClick={() => setScreen('results')}>
            View Results
          </Button>
        </Panel>
      </div>
    </div>
  );
};
