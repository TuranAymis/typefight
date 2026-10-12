import { useAppStore } from '../../store';
import { Button, Panel } from '../components';
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

      <Panel className={styles.placeholderBox}>
        <span className={styles.placeholderCode}>
          [ Placeholder Screen: Gauntlet Combat inactive ]
        </span>
        <p className={styles.cardDesc}>
          Enemy waves, integrity bar, procedural tier progression, and boss encounters will be
          implemented in subsequent phases.
        </p>
      </Panel>

      <div className={styles.actionRow}>
        <Button id="nav-gauntlet-to-menu" variant="secondary" onClick={() => setScreen('menu')}>
          Return to Menu
        </Button>
        <Button id="nav-gauntlet-to-results" variant="primary" onClick={() => setScreen('results')}>
          Complete Encounter
        </Button>
      </div>
    </div>
  );
};
