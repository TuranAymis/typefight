import { useEffect, useState } from 'react';
import { useAppStore, useIdentityStore } from '../../store';
import { fetchLeaderboard } from '../../leaderboard/leaderboardApi';
import type { Board, BoardLang, BoardPeriod } from '../../leaderboard/leaderboardApi';
import styles from './Screens.module.css';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly board: Board };

export const LeaderboardScreen = () => {
  const setScreen = useAppStore((state) => state.setScreen);
  const identity = useIdentityStore((state) => state.identity);
  const [lang, setLang] = useState<BoardLang>('en');
  const [period, setPeriod] = useState<BoardPeriod>('daily');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const token = identity?.deviceToken;

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void fetchLeaderboard(lang, period, token).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: 'ready', board: result.board } : { status: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [lang, period, token, attempt]);

  const myId = identity?.playerId;
  const me = state.status === 'ready' ? state.board.me : null;
  const meInList = state.status === 'ready' && state.board.entries.some((e) => e.playerId === myId);

  return (
    <div className={styles.screenContainer} id="screen-leaderboard">
      <span className={styles.badge}>Rankings</span>
      <h1 className={styles.title}>Leaderboard</h1>

      <div className={styles.boardTabs} role="tablist" aria-label="Period">
        {(['daily', 'all'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            id={`board-period-${value}`}
            aria-selected={period === value}
            className={`${styles.button} ${period === value ? styles.primaryButton : styles.secondaryButton}`}
            onClick={() => setPeriod(value)}
          >
            {value === 'daily' ? 'Daily' : 'All-time'}
          </button>
        ))}
        {(['en', 'tr'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            id={`board-lang-${value}`}
            aria-selected={lang === value}
            className={`${styles.button} ${lang === value ? styles.primaryButton : styles.secondaryButton}`}
            onClick={() => setLang(value)}
          >
            {value.toUpperCase()}
          </button>
        ))}
      </div>

      {state.status === 'loading' && <p id="board-loading">Loading rankings…</p>}
      {state.status === 'error' && (
        <p id="board-error" role="alert">
          Could not load the leaderboard.{' '}
          <button
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {state.status === 'ready' && state.board.entries.length === 0 && (
        <p id="board-empty">No ranked runs yet. Finish a Simulator run with 90%+ accuracy.</p>
      )}
      {state.status === 'ready' && state.board.entries.length > 0 && (
        <table className={styles.boardTable} id="board-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>WPM</th>
              <th>Acc</th>
            </tr>
          </thead>
          <tbody>
            {state.board.entries.map((entry) => (
              <tr
                key={entry.playerId}
                className={entry.playerId === myId ? styles.boardMe : undefined}
                data-me={entry.playerId === myId}
              >
                <td>{entry.rank}</td>
                <td>{entry.nickname}</td>
                <td>{entry.wpm}</td>
                <td>{entry.accuracy}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {me && !meInList && (
        <p className={styles.boardMe} id="board-my-rank">
          Your rank: #{me.rank} · {me.wpm} WPM · {me.accuracy}%
        </p>
      )}

      <button
        id="board-back"
        className={`${styles.button} ${styles.secondaryButton}`}
        onClick={() => setScreen('menu')}
      >
        Back
      </button>
    </div>
  );
};
