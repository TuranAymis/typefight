import { useState } from 'react';
import type { FormEvent } from 'react';
import { NICKNAME_MAX_LENGTH } from '@typefight/texts';
import { useAppStore } from '../../store';
import { useIdentityStore } from '../../store/useIdentityStore';
import { NICKNAME_MESSAGES } from './nicknameMessages';
import styles from './Screens.module.css';

export const NicknameScreen = () => {
  const setScreen = useAppStore((state) => state.setScreen);
  const { error, saving, chooseNickname } = useIdentityStore();
  const [value, setValue] = useState('');

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (await chooseNickname(value)) setScreen('menu');
  };

  return (
    <div className={styles.screenContainer} id="screen-nickname">
      <span className={styles.badge}>Player Profile</span>
      <h1 className={styles.title}>Pick a Nickname</h1>
      <p className={styles.description}>
        No account needed. Your nickname is shown on leaderboards and in duels.
      </p>

      <form className={styles.nicknameForm} onSubmit={(event) => void onSubmit(event)}>
        <label htmlFor="nickname-input" className={styles.cardDesc}>
          Nickname
        </label>
        <input
          id="nickname-input"
          className={styles.nicknameInput}
          value={value}
          maxLength={NICKNAME_MAX_LENGTH + 8}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby="nickname-error"
          onChange={(event) => setValue(event.target.value)}
        />
        <p id="nickname-error" role="alert" className={styles.nicknameError}>
          {error ? NICKNAME_MESSAGES[error] : ''}
        </p>
        <div className={styles.actionRow}>
          <button
            id="nickname-save"
            type="submit"
            className={`${styles.button} ${styles.primaryButton}`}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Nickname'}
          </button>
          <button
            id="nickname-cancel"
            type="button"
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={() => setScreen('menu')}
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
};
