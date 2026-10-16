import { useAppStore } from '../../store';
import { useEffect, useRef } from 'react';
import { track } from '../../analytics';
import { usePortalGameplay } from '../../portal';
import { useCenteredLine } from '../hooks/useCenteredLine';
import { useTypingSurface } from '../hooks/useTypingSurface';
import styles from './Screens.module.css';

export const SimulatorScreen = () => {
  const setScreen = useAppStore((state) => state.setScreen);
  const { typingState, elementRef, reset, warning, cursorEffect } = useTypingSurface();

  const {
    targetText,
    cursorIndex,
    totalKeypresses,
    firstAttemptCorrect,
    erroredAtCurrentIndex,
    isComplete,
  } = typingState;

  const windowRef = useRef<HTMLDivElement>(null);
  useCenteredLine(windowRef, cursorIndex);

  // A run starts with its first keypress and completes when the text is finished.
  const started = totalKeypresses > 0;
  usePortalGameplay(started && !isComplete);
  useEffect(() => {
    if (started) track('sim_started', { lang: 'en' });
  }, [started]);
  useEffect(() => {
    if (isComplete) track('sim_completed', { lang: 'en' });
  }, [isComplete]);

  const typedPart = targetText.slice(0, cursorIndex);
  const cursorChar = cursorIndex < targetText.length ? targetText[cursorIndex] : '';
  const remainingPart = cursorIndex < targetText.length ? targetText.slice(cursorIndex + 1) : '';

  return (
    <div className={styles.screenContainer} id="screen-simulator">
      <span className={styles.badge}>Simulator (Practice Wire)</span>
      <h1 className={styles.title}>The Simulator</h1>
      <p className={styles.description}>
        Blocking input active: press the highlighted key to advance. Wrong keys block and mark
        errors.
      </p>

      <div
        className={styles.typingContainer}
        ref={elementRef}
        data-cursor-effect={cursorEffect}
        tabIndex={0}
        role="textbox"
        aria-label="Yazma alanı"
      >
        {warning && <p role="alert">{warning}</p>}
        <div className={styles.textWindow} ref={windowRef} id="text-window">
          <div className={styles.streamDisplay} id="typing-stream">
            <span className={styles.charTyped} id="typed-part">
              {typedPart}
            </span>
            {cursorChar !== '' && (
              <span
                id="cursor-char"
                data-cursor
                className={`${styles.charCursor} ${
                  erroredAtCurrentIndex ? styles.charCursorError : ''
                }`}
              >
                {cursorChar === ' ' ? '␣' : cursorChar}
              </span>
            )}
            <span className={styles.charRemaining} id="remaining-part">
              {remainingPart}
            </span>
          </div>
        </div>

        {erroredAtCurrentIndex && (
          <div id="error-indicator" className={styles.errorPill}>
            <span>⚠️</span>
            <span>Blocked: Press '{cursorChar === ' ' ? 'Space' : cursorChar}'</span>
          </div>
        )}

        {isComplete && (
          <div id="complete-banner" className={styles.completeNotice}>
            <span>✓ Target Complete!</span>
            <button
              id="btn-restart-practice"
              className={`${styles.button} ${styles.primaryButton}`}
              onClick={() => reset()}
            >
              Restart Practice
            </button>
          </div>
        )}

        <div className={styles.statsRow}>
          <div className={styles.statsPill}>
            <span>Position:</span>
            <span id="stat-position" className={styles.statsValue}>
              {cursorIndex} / {targetText.length}
            </span>
          </div>
          <div className={styles.statsPill}>
            <span>Keypresses:</span>
            <span id="stat-keypresses" className={styles.statsValue}>
              {totalKeypresses}
            </span>
          </div>
          <div className={styles.statsPill}>
            <span>First-Attempt:</span>
            <span id="stat-first-attempt" className={styles.statsValue}>
              {firstAttemptCorrect}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.actionRow}>
        <button
          id="nav-sim-to-menu"
          className={`${styles.button} ${styles.secondaryButton}`}
          onClick={() => setScreen('menu')}
        >
          Return to Menu
        </button>
        <button
          id="btn-reset-text"
          className={`${styles.button} ${styles.secondaryButton}`}
          onClick={() => reset()}
        >
          Reset Text
        </button>
        <button
          id="nav-sim-to-results"
          className={`${styles.button} ${styles.primaryButton}`}
          onClick={() => setScreen('results')}
        >
          Finish & View Results
        </button>
      </div>
    </div>
  );
};
