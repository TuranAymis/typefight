import { useEffect, useState } from 'react';
import { useAppStore, useIdentityStore } from '../../store';
import { createRecoveryCode, fetchProfile, winRate } from '../../profile/profileApi';
import type { Profile } from '../../profile/profileApi';
import styles from './Screens.module.css';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly profile: Profile };

export const ProfileScreen = () => {
  const setScreen = useAppStore((state) => state.setScreen);
  const identity = useIdentityStore((state) => state.identity);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [code, setCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState(false);
  const playerId = identity?.playerId;
  const token = identity?.deviceToken;

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setState({ status: 'loading' });
    void fetchProfile(playerId).then((result) => {
      if (!cancelled)
        setState(result.ok ? { status: 'ready', profile: result.profile } : { status: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [playerId, attempt]);

  const generate = async () => {
    if (!token) return;
    setCodeError(false);
    const result = await createRecoveryCode(token);
    if (result.ok) setCode(result.code);
    else setCodeError(true);
  };

  if (!identity) {
    return (
      <div className={styles.screenContainer} id="screen-profile">
        <h1 className={styles.title}>Profile</h1>
        <p id="profile-anonymous">Pick a nickname first to get a profile.</p>
        <button
          className={`${styles.button} ${styles.primaryButton}`}
          onClick={() => setScreen('nickname')}
        >
          Pick a nickname
        </button>
      </div>
    );
  }

  return (
    <div className={styles.screenContainer} id="screen-profile">
      <span className={styles.badge}>Player Profile</span>
      <h1 className={styles.title}>{identity.nickname}</h1>

      {state.status === 'loading' && <p id="profile-loading">Loading profile…</p>}
      {state.status === 'error' && (
        <p id="profile-error" role="alert">
          Could not load the profile.{' '}
          <button
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {state.status === 'ready' && (
        <dl className={styles.statGrid} id="profile-stats">
          <div>
            <dt>Rating</dt>
            <dd id="stat-rating">{state.profile.rating}</dd>
          </div>
          <div>
            <dt>Best WPM</dt>
            <dd id="stat-best-wpm">{state.profile.bestWpm}</dd>
          </div>
          <div>
            <dt>Avg accuracy</dt>
            <dd id="stat-accuracy">{state.profile.averageAccuracy}%</dd>
          </div>
          <div>
            <dt>Win rate</dt>
            <dd id="stat-win-rate">{winRate(state.profile.duels)}%</dd>
          </div>
          <div>
            <dt>Duels</dt>
            <dd id="stat-duels">{state.profile.duels.played}</dd>
          </div>
        </dl>
      )}

      <section className={styles.recoveryBox} aria-labelledby="recovery-title">
        <h2 id="recovery-title" className={styles.cardTitle}>
          Recovery code
        </h2>
        <p className={styles.cardDesc}>
          Your profile lives in this browser. A recovery code lets you restore it on another browser
          or device. Anyone with the code can take over your profile, so keep it private. Creating a
          new code invalidates the old one.
        </p>
        {code ? (
          <p id="recovery-code" className={styles.recoveryCode}>
            {code}
          </p>
        ) : (
          <button
            id="recovery-generate"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={() => void generate()}
          >
            Create recovery code
          </button>
        )}
        {code && (
          <p id="recovery-note" className={styles.cardDesc}>
            Write this down now. It is shown only once and cannot be recovered later.
          </p>
        )}
        {codeError && (
          <p id="recovery-error" role="alert">
            Could not create a code. Try again.
          </p>
        )}
      </section>

      <button
        id="profile-back"
        className={`${styles.button} ${styles.secondaryButton}`}
        onClick={() => setScreen('menu')}
      >
        Back
      </button>
    </div>
  );
};
