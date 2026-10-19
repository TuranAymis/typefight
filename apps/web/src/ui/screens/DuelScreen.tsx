import { GLITCH_CONFIG } from '@typefight/texts';
import { useDuelGlitches } from '../../duel/useDuelGlitches';
import glitchStyles from './DuelGlitch.module.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RECORD_VERSION, computeComboTimeline } from '@typefight/engine';
import type { KeyEvent } from '@typefight/engine';
import { useAppStore, useIdentityStore } from '../../store';
import { track } from '../../analytics';
import { playSound } from '../../audio';
import { portal, usePortalGameplay } from '../../portal';
import { startDuel, submitDuel } from '../../duel/duelApi';
import type { DuelApiError, DuelOutcome, DuelStart } from '../../duel/duelApi';
import {
  COUNTDOWN_SECONDS,
  DUEL_DURATION_MS,
  MAX_HP,
  ghostPosition,
  liveDuel,
  trimEvents,
} from '../../duel/duelLive';
import { useCenteredLine } from '../hooks/useCenteredLine';
import { useTypingSurface } from '../hooks/useTypingSurface';
import styles from './Screens.module.css';

type Phase =
  | { readonly name: 'lobby' }
  | { readonly name: 'searching' }
  | { readonly name: 'found'; readonly duel: DuelStart }
  | { readonly name: 'countdown'; readonly duel: DuelStart; readonly remaining: number }
  | { readonly name: 'fight'; readonly duel: DuelStart }
  | { readonly name: 'submitting'; readonly duel: DuelStart }
  | { readonly name: 'result'; readonly duel: DuelStart; readonly outcome: DuelOutcome }
  | { readonly name: 'error'; readonly error: DuelApiError; readonly retry: () => void };

const FOUND_MS = 1500;
const DAMAGE_FLASH_MS = 900;

const ERROR_MESSAGES: Record<DuelApiError, string> = {
  unauthorized: 'Your profile was not recognised. Pick a nickname again.',
  rate_limited: 'Too many duels in a short time. Wait a few minutes.',
  not_found: 'That opponent is no longer available.',
  network: 'Could not reach the server. Check your connection.',
  server: 'Something went wrong. Try again.',
};

const REASON_LABELS: Record<DuelOutcome['duel']['reason'], string> = {
  ko: 'Knockout',
  hp: 'More HP when time ran out',
  wpm: 'Higher WPM after equal HP',
  accuracy: 'Higher accuracy after equal HP and WPM',
  draw: 'Dead even',
};

const HpBar = ({ id, label, hp }: { id: string; label: string; hp: number }) => (
  <div className={styles.hpBlock}>
    <span className={styles.hpLabel}>{label}</span>
    <div
      id={id}
      className={styles.hpTrack}
      role="progressbar"
      aria-label={`${label} HP`}
      aria-valuemin={0}
      aria-valuemax={MAX_HP}
      aria-valuenow={hp}
    >
      <div className={styles.hpFill} style={{ width: `${(hp / MAX_HP) * 100}%` }} />
    </div>
    <span className={styles.hpValue}>{hp}</span>
  </div>
);

interface FightViewProps {
  readonly duel: DuelStart;
  readonly nickname: string;
  readonly onFinish: (duel: DuelStart, events: readonly KeyEvent[], endsAt: number) => void;
}

/** The running duel. Mounted only for the fight so the typing surface binds to its own element. */
const FightView = ({ duel, nickname, onFinish }: FightViewProps) => {
  const { typedBuffer, events, elementRef, reset, cursorEffect } = useTypingSurface();
  const cursorIndex = typedBuffer.length;
  // FightView only exists while the duel is being fought (not lobby, countdown or result).
  usePortalGameplay(true);
  const [elapsed, setElapsed] = useState(0);
  const windowRef = useRef<HTMLDivElement>(null);
  useCenteredLine(windowRef, cursorIndex);
  const opponent = duel.opponent;
  const glitches = useDuelGlitches(duel, events, elapsed);

  // One duel_started per duel (the ref also covers React StrictMode's repeated effect run).
  const trackedDuel = useRef<string | null>(null);
  useEffect(() => {
    if (trackedDuel.current === duel.sessionId) return;
    trackedDuel.current = duel.sessionId;
    track('duel_started', { lang: duel.lang, opponent: duel.opponent.isBot ? 'bot' : 'ghost' });
  }, [duel]);

  // The clock starts together with a fresh typing record, so keystroke times and the ghost replay
  // share the same zero.
  useEffect(() => {
    reset(duel.text, duel.lang);
    const startedAt = performance.now();
    let frame = 0;
    const tick = () => {
      setElapsed(Math.min(performance.now() - startedAt, DUEL_DURATION_MS));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
    // reset is stable per surface; run once per fight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel]);

  const live = useMemo(
    () =>
      liveDuel({
        targetText: duel.text,
        locale: duel.lang,
        events,
        elapsedMs: elapsed,
        ghost: opponent.record,
        ...(duel.glitch ? { glitch: duel.glitch } : {}),
      }),
    [duel, opponent.record, events, elapsed],
  );
  const combo = useMemo(() => {
    const timeline = computeComboTimeline({
      version: RECORD_VERSION,
      targetText: duel.text,
      locale: duel.lang,
      events: events.filter((event) => event.t <= elapsed),
      durationMs: Math.max(elapsed, 1),
    });
    const staggered = timeline.events.some(
      (event) => event.type === 'stagger' && event.t <= elapsed && elapsed < event.endsAt,
    );
    return { combo: timeline.finalCombo, staggered };
  }, [duel, events, elapsed]);

  // A hit sound for every damage event, whoever dealt it.
  const damageCount = live.damageEvents.length;
  const lastDamageCount = useRef(damageCount);
  useEffect(() => {
    if (damageCount > lastDamageCount.current) playSound('hit');
    lastDamageCount.current = damageCount;
  }, [damageCount]);

  // End conditions: knockout, text finished, or time up.
  useEffect(() => {
    if (live.koAt !== null) onFinish(duel, events, live.koAt);
    else if (cursorIndex >= duel.text.length) {
      onFinish(duel, events, (events[events.length - 1]?.t ?? 0) + 1);
    } else if (elapsed >= DUEL_DURATION_MS) onFinish(duel, events, DUEL_DURATION_MS);
  }, [duel, live, cursorIndex, elapsed, events, onFinish]);

  const hp = live.hp;
  const remainingSeconds = Math.max(0, Math.ceil((DUEL_DURATION_MS - elapsed) / 1000));
  const ghostAt = ghostPosition(opponent.record, elapsed);
  const flashes = live.damageEvents.filter((event) => elapsed - event.t < DAMAGE_FLASH_MS);
  const chars = [...duel.text];
  const wordAt: number[] = [];
  let word = 0;
  for (const char of chars) {
    wordAt.push(word);
    if (char === ' ') word += 1;
  }
  const markedWords = new Set(duel.glitch?.markers.map((marker) => marker.wordIndex));
  const effectNames = glitches.active.map((entry) => entry.fire.effect);

  return (
    <div className={styles.screenContainer} id="screen-duel">
      <div className={styles.hud} id="duel-hud">
        <HpBar id="hp-player" label={nickname} hp={hp.player} />
        <div className={styles.hudCenter}>
          <span id="duel-timer" className={styles.timer}>
            {remainingSeconds}
          </span>
          <span id="duel-combo" className={styles.comboPill}>
            Combo x{combo.combo}
          </span>
          {combo.staggered && (
            <span id="duel-stagger" className={styles.staggerPill}>
              Staggered
            </span>
          )}
        </div>
        <HpBar id="hp-opponent" label={opponent.nickname} hp={hp.opponent} />
      </div>

      <div className={styles.damageRow} aria-live="polite">
        {flashes.map((event) => (
          <span
            key={`${event.source}-${event.t}`}
            className={event.source === 'player' ? styles.damageDealt : styles.damageTaken}
            data-source={event.source}
          >
            {event.source === 'player'
              ? `-${event.amount} ${opponent.nickname}`
              : `-${event.amount} You`}
          </span>
        ))}
      </div>

      <p id="duel-glitch-feedback" aria-live="polite">
        {glitches.feedback}
      </p>
      <div id="duel-glitch-effects" className={glitchStyles['effect-marker']}>
        {glitches.active.map(({ fire, remainingMs }) => (
          <span key={fire.glitchId} data-effect={fire.effect}>
            {fire.effect.toUpperCase()} {Math.ceil(remainingMs / 1000)}s{' '}
          </span>
        ))}
        {glitches.incomingWords > 0 && (
          <span data-effect="overclock">
            Incoming OVERCLOCK x{GLITCH_CONFIG.overclockMultiplier}: {glitches.incomingWords} words
          </span>
        )}
      </div>
      <div
        className={styles.typingContainer}
        ref={elementRef}
        data-cursor-effect={cursorEffect}
        tabIndex={0}
        role="textbox"
        aria-label="Duel typing area"
      >
        <div
          className={[
            glitchStyles['window-frame'],
            effectNames.includes('blackout') ? glitchStyles.blackout : '',
            effectNames.includes('static') ? glitchStyles.static : '',
          ]
            .filter(Boolean)
            .join(' ')}
          id="duel-visual-effects"
        >
          <div className={styles.textWindow} ref={windowRef} id="duel-window">
            <div
              className={styles.streamDisplay}
              id="duel-stream"
              role="group"
              aria-label={duel.text}
            >
              {chars.map((char, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  data-cursor={index === cursorIndex ? '' : undefined}
                  className={[
                    index >= cursorIndex
                      ? styles.charRemaining
                      : typedBuffer[index] === char
                        ? styles.charTyped
                        : styles.charWrong,
                    index === cursorIndex ? styles.charCursor : '',
                    index === ghostAt.cursor ? styles.ghostMark : '',
                    markedWords.has(wordAt[index] ?? -1) ? glitchStyles['glitch-word'] : '',
                    glitches.boosted.includes(wordAt[index] ?? -1)
                      ? glitchStyles['boosted-word']
                      : '',
                    glitchStyles['word-start'],
                  ].join(' ')}
                >
                  {glitches.boosted.includes(wordAt[index] ?? -1) &&
                    (index === 0 || chars[index - 1] === ' ') && (
                      <span className={glitchStyles.multiplier}>
                        x{GLITCH_CONFIG.overclockMultiplier}
                      </span>
                    )}
                  {effectNames.includes('scramble') &&
                  index >= glitches.nextStart &&
                  index < glitches.nextEnd ? (
                    <>
                      <span className={glitchStyles['visual-char']}>
                        {glitches.scrambled[index - glitches.nextStart]}
                      </span>
                      <span className={glitchStyles['real-char']}>{char}</span>
                    </>
                  ) : (
                    char
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.ghostTrack} aria-hidden="true">
          <div
            id="ghost-progress"
            className={styles.ghostFill}
            style={{ width: `${(ghostAt.cursor / chars.length) * 100}%` }}
          />
        </div>
        <p className={styles.cardDesc}>
          {opponent.isBot ? '[BOT] ' : 'Ghost: '}
          {opponent.nickname} is at {ghostAt.cursor}/{chars.length}
        </p>
      </div>
    </div>
  );
};

export const DuelScreen = () => {
  const setScreen = useAppStore((state) => state.setScreen);
  const identity = useIdentityStore((state) => state.identity);
  const [lang, setLang] = useState<'en' | 'tr'>('en');
  const [phase, setPhase] = useState<Phase>({ name: 'lobby' });
  const finishing = useRef(false);
  const token = identity?.deviceToken;

  const find = useCallback(
    async (rematchSessionId?: string) => {
      if (!token) return;
      finishing.current = false;
      setPhase({ name: 'searching' });
      const result = await startDuel(token, lang, rematchSessionId);
      if (!result.ok) {
        setPhase({ name: 'error', error: result.error, retry: () => void find(rematchSessionId) });
        return;
      }
      setPhase({ name: 'found', duel: result.duel });
    },
    [token, lang],
  );

  // Match Found -> 3-2-1 -> fight.
  useEffect(() => {
    if (phase.name === 'found') {
      const timer = window.setTimeout(
        () => setPhase({ name: 'countdown', duel: phase.duel, remaining: COUNTDOWN_SECONDS }),
        FOUND_MS,
      );
      return () => window.clearTimeout(timer);
    }
    if (phase.name === 'countdown') {
      const timer = window.setTimeout(() => {
        if (phase.remaining > 1) setPhase({ ...phase, remaining: phase.remaining - 1 });
        else setPhase({ name: 'fight', duel: phase.duel });
      }, 1000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase]);

  // Victory or defeat jingle once when the result arrives (a draw stays quiet).
  useEffect(() => {
    if (phase.name !== 'result') return;
    const { winner, reason } = phase.outcome.duel;
    track('duel_completed', { lang: phase.duel.lang, winner, reason });
    if (winner === 'player') {
      playSound('victory');
      portal.happytime();
    } else if (winner === 'opponent') playSound('defeat');
  }, [phase]);

  const finish = useCallback(
    async (duel: DuelStart, events: readonly KeyEvent[], endsAt: number) => {
      if (!token || finishing.current) return;
      finishing.current = true;
      setPhase({ name: 'submitting', duel });
      const submission = {
        sessionId: duel.sessionId,
        sessionToken: duel.sessionToken,
        events: trimEvents(events, endsAt),
        durationMs: Math.max(Math.round(endsAt), 1),
      };
      const send = async () => {
        const result = await submitDuel(token, submission);
        if (result.ok) setPhase({ name: 'result', duel, outcome: result.outcome });
        else setPhase({ name: 'error', error: result.error, retry: () => void send() });
      };
      await send();
    },
    [token],
  );

  if (!identity) {
    return (
      <div className={styles.screenContainer} id="screen-duel">
        <h1 className={styles.title}>Duel</h1>
        <p>Pick a nickname first so your opponent knows who they are fighting.</p>
        <button
          className={`${styles.button} ${styles.primaryButton}`}
          onClick={() => setScreen('nickname')}
        >
          Pick a nickname
        </button>
      </div>
    );
  }

  if (phase.name === 'lobby') {
    return (
      <div className={styles.screenContainer} id="screen-duel">
        <span className={styles.badge}>Ghost Duel</span>
        <h1 className={styles.title}>Duel</h1>
        <p className={styles.description}>
          Race a real player&apos;s recorded run (or a clearly labelled bot) on the same text. Clean
          words build combos and damage your opponent. 60 seconds, 100 HP each.
        </p>
        <div className={styles.boardTabs} role="radiogroup" aria-label="Language">
          {(['en', 'tr'] as const).map((value) => (
            <button
              key={value}
              role="radio"
              aria-checked={lang === value}
              id={`duel-lang-${value}`}
              className={`${styles.button} ${lang === value ? styles.primaryButton : styles.secondaryButton}`}
              onClick={() => setLang(value)}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>
        <div className={styles.actionRow}>
          <button
            id="duel-find"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={() => void find()}
          >
            Find Opponent
          </button>
          <button
            id="duel-back"
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={() => setScreen('menu')}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (phase.name === 'searching') {
    return (
      <div className={styles.screenContainer} id="screen-duel">
        <h1 className={styles.title}>Searching…</h1>
        <p id="duel-searching" role="status">
          Looking for an opponent on your level.
        </p>
      </div>
    );
  }

  if (phase.name === 'error') {
    return (
      <div className={styles.screenContainer} id="screen-duel">
        <h1 className={styles.title}>Duel</h1>
        <p id="duel-error" role="alert">
          {ERROR_MESSAGES[phase.error]}
        </p>
        <div className={styles.actionRow}>
          {phase.error !== 'unauthorized' && (
            <button
              id="duel-retry"
              className={`${styles.button} ${styles.primaryButton}`}
              onClick={phase.retry}
            >
              Try again
            </button>
          )}
          <button
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={() => setPhase({ name: 'lobby' })}
          >
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  const duel = phase.duel;
  const opponent = duel.opponent;

  if (phase.name === 'found' || phase.name === 'countdown') {
    return (
      <div className={styles.screenContainer} id="screen-duel">
        <span className={styles.badge}>Match Found</span>
        <h1 className={styles.title} id="duel-opponent-name">
          {opponent.nickname}
        </h1>
        <p id="duel-opponent-info">
          {opponent.isBot ? 'Training bot' : 'Ghost of a real player'} · rating {opponent.rating} ·{' '}
          {opponent.wpm} WPM
        </p>
        {phase.name === 'countdown' && (
          <p id="duel-countdown" className={styles.countdown} role="timer" aria-live="assertive">
            {phase.remaining}
          </p>
        )}
      </div>
    );
  }

  if (phase.name === 'submitting') {
    return (
      <div className={styles.screenContainer} id="screen-duel">
        <h1 className={styles.title}>Judging…</h1>
        <p id="duel-submitting" role="status">
          The server is confirming the fight.
        </p>
      </div>
    );
  }

  if (phase.name === 'result') {
    const { outcome } = phase;
    const title =
      outcome.duel.winner === 'player'
        ? 'Victory'
        : outcome.duel.winner === 'opponent'
          ? 'Defeat'
          : 'Draw';
    return (
      <div className={styles.screenContainer} id="screen-duel">
        <span className={styles.badge}>{REASON_LABELS[outcome.duel.reason]}</span>
        <h1 className={styles.title} id="duel-result-title" data-winner={outcome.duel.winner}>
          {title}
        </h1>
        <p id="duel-result-detail">
          You {outcome.duel.hp.a} HP · {opponent.nickname} {outcome.duel.hp.b} HP ·{' '}
          {outcome.result.wpm} WPM · {outcome.result.accuracy}% accuracy
        </p>
        <p id="duel-result-rating">
          {outcome.duel.ratingApplied
            ? `Rating ${outcome.duel.rating.before} → ${outcome.duel.rating.after} (${outcome.duel.rating.delta >= 0 ? '+' : ''}${outcome.duel.rating.delta})`
            : 'This run did not count for your rating.'}
        </p>
        {outcome.newBadges && outcome.newBadges.length > 0 && (
          <p id="duel-new-badges" role="status">
            Badge unlocked: {outcome.newBadges.map((badge) => badge.name).join(', ')}
          </p>
        )}
        <div className={styles.actionRow}>
          <button
            id="duel-rematch"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={() => {
              track('rematch', { lang: duel.lang });
              void find(opponent.sessionId);
            }}
          >
            Rematch
          </button>
          <button
            id="duel-new-opponent"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={() => void find()}
          >
            New Opponent
          </button>
          <button
            id="duel-to-menu"
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={() => setScreen('menu')}
          >
            Menu
          </button>
        </div>
      </div>
    );
  }

  return <FightView duel={duel} nickname={identity.nickname} onFinish={finish} />;
};
