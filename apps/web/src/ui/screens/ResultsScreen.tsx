import { useAppStore } from '../../store';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { Button, HudText, Panel } from '../components';
import { computeChartPoints, formatStat } from './simulatorHelpers';
import styles from './Screens.module.css';

export const ResultsScreen = () => {
  const setScreen = useAppStore((state) => state.setScreen);
  const result = useSimulatorStore((state) => state.result);
  const restart = useSimulatorStore((state) => state.restart);
  const newSession = useSimulatorStore((state) => state.newSession);

  if (!result)
    return (
      <div className={styles.screenContainer} id="screen-results">
        <h1 className={styles.title}>No simulator result yet</h1>
        <Button onClick={() => setScreen('simulator')}>Start simulator</Button>
      </div>
    );

  const points = computeChartPoints(result.state, result.metrics.durationMs);
  const maximum = Math.max(12, ...points);
  const polyline = points
    .map(
      (value, index) =>
        `${(index / Math.max(1, points.length - 1)) * 600},${120 - (value / maximum) * 110}`,
    )
    .join(' ');
  return (
    <div className={styles.screenContainer} id="screen-results">
      <span className={`${styles.badge} ${styles.badgeResults}`}>Run analysis</span>
      <h1 className={styles.title}>Simulator results</h1>
      <p className={styles.description} id="result-mode">
        {result.duration}s · {result.locale.toUpperCase()} · Seed {result.seed}
      </p>
      <Panel className={styles.resultsPanel}>
        <div className={styles.resultGrid}>
          <HudText label="WPM" value={formatStat(result.metrics.wpm)} valueId="result-wpm" />
          <HudText
            label="Raw WPM"
            value={formatStat(result.metrics.rawWpm)}
            valueId="result-raw-wpm"
          />
          <HudText
            label="Accuracy"
            value={`${formatStat(result.metrics.accuracy)}%`}
            valueId="result-accuracy"
          />
          <HudText
            label="Consistency"
            value={`${formatStat(result.metrics.consistency)}%`}
            valueId="result-consistency"
          />
        </div>
        <h2 className={styles.chartTitle}>WPM over time</h2>
        <svg
          className={styles.chart}
          viewBox="0 0 600 140"
          role="img"
          aria-label="WPM over time chart"
          preserveAspectRatio="none"
        >
          <line x1="0" y1="120" x2="600" y2="120" className={styles.chartAxis} />
          <polyline points={polyline} className={styles.chartLine} fill="none" />
        </svg>
      </Panel>
      <div className={styles.actionRow}>
        <Button
          id="restart-simulator"
          onClick={() => {
            restart();
            setScreen('simulator');
          }}
        >
          Restart
        </Button>
        <Button
          id="new-simulator-session"
          variant="secondary"
          onClick={() => {
            newSession();
            setScreen('simulator');
          }}
        >
          New session
        </Button>
        <Button variant="secondary" onClick={() => setScreen('menu')}>
          Return to Menu
        </Button>
      </div>
    </div>
  );
};
