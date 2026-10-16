import { useEffect, useRef, useState } from 'react';
import { tutorialView } from '@typefight/engine';
import { ONBOARDING } from '@typefight/texts';
import { track } from '../../analytics';
import { playSound } from '../../audio';
import { usePortalGameplay } from '../../portal';
import { useAppStore } from '../../store';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { useTypingSurface } from '../hooks/useTypingSurface';
import shared from './Screens.module.css';
import styles from './OnboardingScreen.module.css';

// 64 characters / 5 chars per word / 37.5 WPM * 60 = 20.5 seconds (19.2–21.9 at 35–40 WPM).
const TEXT = ONBOARDING.segments.map((segment) => segment.text).join('');

const Tutorial = () => {
  const { typingState, elementRef, reset, cursorEffect } = useTypingSurface();
  const complete = useOnboardingStore((state) => state.complete);
  const setScreen = useAppStore((state) => state.setScreen);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);
  const readyButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!initialized.current) {
      reset(TEXT, 'en');
      initialized.current = true;
    }
    // The keyboard bridge timestamps events relative to reset using performance.now().
    const started = performance.now();
    const timer = window.setInterval(() => setNow(performance.now() - started), 50);
    return () => window.clearInterval(timer);
    // Reset has surface lifetime semantics, but the hook returns a new wrapper each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const view = tutorialView(ONBOARDING, typingState, now);
  usePortalGameplay(typingState.totalKeypresses > 0 && !view.complete);
  // The scripted glitch demo gets its sound the moment it starts.
  useEffect(() => {
    if (!view.glitchActive) return;
    playSound('glitch');
    track('glitch_fired', { source: 'tutorial' });
  }, [view.glitchActive]);
  useEffect(() => {
    if (view.complete) {
      void complete();
      setReady(true);
    }
  }, [view.complete, complete]);
  useEffect(() => {
    if (ready) readyButton.current?.focus();
  }, [ready]);

  return (
    <>
      <div className={styles['top-row']}>
        <span className={shared.badge}>Practice duel · about 20 seconds</span>
        <button
          id="onboarding-skip"
          className={`${shared.button} ${shared.secondaryButton}`}
          onClick={async () => {
            await complete();
            setScreen('duel');
          }}
        >
          Skip
        </button>
      </div>
      {ready ? (
        <div className={styles['ready-panel']}>
          <h1>You're ready!</h1>
          <button
            id="onboarding-start-duel"
            ref={readyButton}
            className={`${shared.button} ${shared.primaryButton}`}
            onClick={() => setScreen('duel')}
          >
            Find a real duel
          </button>
        </div>
      ) : (
        <>
          <h1 className={shared.title}>Your first duel</h1>
          <p className={styles.caption} aria-live="polite" aria-atomic="true">
            {view.caption}
          </p>
          <div className={`${shared.hpBlock} ${styles.hp}`}>
            <span className={shared.hpLabel}>{ONBOARDING.opponentLabel}</span>
            <div
              className={shared.hpTrack}
              role="progressbar"
              aria-label="Training dummy HP"
              aria-valuemin={0}
              aria-valuemax={ONBOARDING.maxHp}
              aria-valuenow={view.hp}
            >
              <div
                className={shared.hpFill}
                style={{ width: `${(view.hp / ONBOARDING.maxHp) * 100}%` }}
              />
            </div>
            <span className={shared.hpValue}>{view.hp} HP</span>
          </div>
        </>
      )}
      <div
        hidden={ready}
        className={`${shared.typingContainer} ${styles.surface}`}
        ref={elementRef}
        data-cursor-effect={cursorEffect}
        role="textbox"
        tabIndex={0}
        aria-label="Tutorial typing area"
        aria-describedby="tutorial-caption"
      >
        <div className={styles.phrase}>
          {[...TEXT].map((char, index) => (
            <span
              key={index}
              data-cursor={index === typingState.cursorIndex ? '' : undefined}
              className={[
                index < typingState.cursorIndex ? shared.charTyped : shared.charRemaining,
                index === typingState.cursorIndex ? shared.charCursor : '',
                index === typingState.cursorIndex && typingState.erroredAtCurrentIndex
                  ? shared.charCursorError
                  : '',
                view.glitchActive && index > typingState.cursorIndex ? styles.distorted : '',
              ].join(' ')}
            >
              {char}
            </span>
          ))}
        </div>
        <p id="tutorial-caption" className={styles['demo-label']}>
          {view.glitchActive ? ONBOARDING.demoLabel : '\u00a0'}
        </p>
      </div>
    </>
  );
};

export const OnboardingScreen = () => {
  const [attempt, setAttempt] = useState(0);
  return (
    <div id="screen-onboarding" className={`${shared.screenContainer} ${styles.screen}`}>
      <Tutorial key={attempt} />
      <button
        id="onboarding-replay"
        className={`${shared.button} ${shared.secondaryButton}`}
        onClick={() => setAttempt((value) => value + 1)}
      >
        Replay
      </button>
    </div>
  );
};
