import { useAppStore } from '../../store';
import styles from './Screens.module.css';

export const GauntletScreen = () => {
  const setScreen = useAppStore((state) => state.setScreen);

  return (
    <div className={styles.screenContainer} id="screen-gauntlet">
      <span className={`${styles.badge} ${styles.badgeGauntlet}`}>RPG Campaign</span>
      <h1 className={styles.title}>The Gauntlet</h1>
      <p className={styles.description}>
        Wave defense mode. Descending words, target locking, and idle typo penalties.
      </p>

      <div className={styles.placeholderBox}>
        <span className={styles.placeholderCode}>
          [ Placeholder Screen: Gauntlet Combat inactive ]
        </span>
        <p className={styles.cardDesc}>
          Enemy waves, integrity bar, procedural tier progression, and boss encounters will be
          implemented in subsequent phases.
        </p>
      </div>

      <div className={styles.actionRow}>
        <button
          id="nav-gauntlet-to-menu"
          className={`${styles.button} ${styles.secondaryButton}`}
          onClick={() => setScreen('menu')}
        >
          Return to Menu
        </button>
        <button
          id="nav-gauntlet-to-results"
          className={`${styles.button} ${styles.primaryButton}`}
          onClick={() => setScreen('results')}
        >
          Complete Encounter
        </button>
      </div>
    </div>
  );
};
