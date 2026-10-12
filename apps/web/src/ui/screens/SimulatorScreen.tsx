import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { useTypingSurface } from '../hooks/useTypingSurface';
import { Button, HudText, NeonCursor, Panel } from '../components';
import {
  computeSimulatorStats,
  createSimulatorText,
  formatStat,
  type SimulatorDuration,
  type SimulatorLocale,
} from './simulatorHelpers';
import styles from './Screens.module.css';

const pickSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;

const SimulatorRun = ({
  targetText,
  duration,
}: {
  targetText: string;
  duration: SimulatorDuration;
}) => {
  const setScreen = useAppStore((state) => state.setScreen);
  const finish = useSimulatorStore((state) => state.finish);
  const { typingState, events, startedAtMs, elementRef, reset, warning } =
    useTypingSurface(targetText);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number | null>(null);
  const latest = useRef({ typingState, events });
  latest.current = { typingState, events };
  const finished = useRef(false);

  useEffect(() => {
    if (startedAtMs !== null && startedAt.current === null) startedAt.current = startedAtMs;
  }, [startedAtMs]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (startedAt.current === null || finished.current) return;
      const elapsed = Math.min(duration * 1000, performance.now() - startedAt.current);
      setElapsedMs(elapsed);
      if (elapsed >= duration * 1000) {
        finished.current = true;
        finish(latest.current.typingState, latest.current.events, elapsed);
        setScreen('results');
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [duration, finish, setScreen]);

  useEffect(() => {
    if (!typingState.isComplete || finished.current) return;
    finished.current = true;
    finish(
      typingState,
      events,
      Math.max(1, performance.now() - (startedAt.current ?? performance.now())),
    );
    setScreen('results');
  }, [typingState, events, elapsedMs, finish, setScreen]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      startedAt.current = null;
      finished.current = false;
      setElapsedMs(0);
      reset();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [reset]);

  const { cursorIndex, erroredAtCurrentIndex } = typingState;
  const stats = computeSimulatorStats(typingState, elapsedMs);
  const words = targetText.split(' ');
  let position = 0;

  return (
    <div className={styles.screenContainer} id="screen-simulator">
      <span className={styles.badge}>Simulator</span>
      <h1 className={styles.title}>The Simulator</h1>
      <p className={styles.description}>Type the highlighted text. Esc restarts this run.</p>
      <div className={styles.statsRow}>
        <HudText label="WPM" value={formatStat(stats.wpm)} valueId="stat-wpm" />
        <HudText
          label="Accuracy"
          value={`${formatStat(stats.accuracy)}%`}
          valueId="stat-accuracy"
        />
        <HudText
          label="Time"
          value={`${formatStat(Math.max(0, duration - elapsedMs / 1000))}s`}
          valueId="stat-time"
        />
        <HudText
          label="Progress"
          value={`${formatStat(stats.progress)}%`}
          valueId="stat-progress"
        />
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label="Text progress"
        aria-valuenow={Math.round(stats.progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={styles.progressFill} style={{ width: `${stats.progress}%` }} />
      </div>
      <div
        className={styles.typingContainer}
        ref={elementRef}
        tabIndex={0}
        role="textbox"
        aria-label="Typing surface"
        aria-multiline="false"
      >
        {warning && <p role="alert">{warning}</p>}
        <div className={styles.streamDisplay} id="typing-stream" aria-label={targetText}>
          {words.map((word, wordIndex) => {
            const start = position;
            position += word.length + (wordIndex < words.length - 1 ? 1 : 0);
            return (
              <span className={styles.word} key={start}>
                {Array.from(word).map((char, offset) => {
                  const index = start + offset;
                  const status =
                    index < cursorIndex
                      ? 'correct'
                      : index === cursorIndex && erroredAtCurrentIndex
                        ? 'incorrect'
                        : 'pending';
                  return index === cursorIndex ? (
                    <NeonCursor
                      key={index}
                      id="cursor-char"
                      error={erroredAtCurrentIndex}
                      data-state={status}
                    >
                      {char}
                    </NeonCursor>
                  ) : (
                    <span
                      key={index}
                      data-state={status}
                      className={status === 'correct' ? styles.charTyped : styles.charRemaining}
                    >
                      {char}
                    </span>
                  );
                })}
                {wordIndex < words.length - 1 &&
                  (position - 1 === cursorIndex ? (
                    <NeonCursor
                      id="cursor-char"
                      key="space"
                      error={erroredAtCurrentIndex}
                      data-state={erroredAtCurrentIndex ? 'incorrect' : 'pending'}
                    >
                      ␣
                    </NeonCursor>
                  ) : (
                    <span
                      key="space"
                      data-state={position - 1 < cursorIndex ? 'correct' : 'pending'}
                      className={
                        position - 1 < cursorIndex ? styles.charTyped : styles.charRemaining
                      }
                    >
                      {' '}
                    </span>
                  ))}
              </span>
            );
          })}
        </div>
        {erroredAtCurrentIndex && (
          <div id="error-indicator" className={styles.errorPill}>
            Blocked: press the highlighted character
          </div>
        )}
        <div className={styles.statsRow}>
          <HudText
            label="Position"
            value={`${cursorIndex} / ${targetText.length}`}
            valueId="stat-position"
          />
          <HudText
            label="Keypresses"
            value={typingState.totalKeypresses}
            valueId="stat-keypresses"
          />
        </div>
      </div>
      <div className={styles.actionRow}>
        <Button variant="secondary" onClick={() => setScreen('menu')}>
          Return to Menu
        </Button>
      </div>
    </div>
  );
};

export const SimulatorScreen = () => {
  const duration = useSimulatorStore((state) => state.duration);
  const locale = useSimulatorStore((state) => state.locale);
  const seed = useSimulatorStore((state) => state.seed);
  const setDuration = useSimulatorStore((state) => state.setDuration);
  const setLocale = useSimulatorStore((state) => state.setLocale);
  const start = useSimulatorStore((state) => state.start);
  const setScreen = useAppStore((state) => state.setScreen);
  if (seed !== null)
    return (
      <SimulatorRun key={seed} targetText={createSimulatorText(locale, seed)} duration={duration} />
    );
  return (
    <div className={styles.screenContainer} id="screen-simulator">
      <span className={styles.badge}>Simulator</span>
      <h1 className={styles.title}>Choose your session</h1>
      <Panel className={styles.selectorPanel} title="Duration">
        <div className={styles.actionRow}>
          {([15, 30, 60] as const).map((choice) => (
            <Button
              key={choice}
              variant={duration === choice ? 'primary' : 'secondary'}
              aria-pressed={duration === choice}
              onClick={() => setDuration(choice)}
            >
              {choice}s
            </Button>
          ))}
        </div>
      </Panel>
      <Panel className={styles.selectorPanel} title="Language">
        <div className={styles.actionRow}>
          {(['en', 'tr'] as const).map((choice: SimulatorLocale) => (
            <Button
              key={choice}
              variant={locale === choice ? 'primary' : 'secondary'}
              aria-pressed={locale === choice}
              onClick={() => setLocale(choice)}
            >
              {choice.toUpperCase()}
            </Button>
          ))}
        </div>
      </Panel>
      <div className={styles.actionRow}>
        <Button id="start-simulator" onClick={() => start(pickSeed())}>
          Start session
        </Button>
        <Button variant="secondary" onClick={() => setScreen('menu')}>
          Return to Menu
        </Button>
      </div>
    </div>
  );
};
