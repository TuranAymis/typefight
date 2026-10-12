import { beforeEach, expect, it } from 'vitest';
import { createTypingState, typingReducer } from '@typefight/engine';
import { useSimulatorStore } from './useSimulatorStore';

beforeEach(() =>
  useSimulatorStore.setState({ duration: 30, locale: 'en', seed: null, result: null }),
);

it('stores a completed run with its mode and seed, then restarts or clears it', () => {
  const store = useSimulatorStore.getState();
  store.setDuration(15);
  store.setLocale('tr');
  store.start(123);
  const state = typingReducer(createTypingState('a'), { key: 'a', timestamp: 0 });
  useSimulatorStore.getState().finish(state, [{ key: 'a', t: 0 }], 1000);
  expect(useSimulatorStore.getState().result).toMatchObject({
    duration: 15,
    locale: 'tr',
    seed: 123,
  });
  expect(useSimulatorStore.getState().result?.metrics.wpm).toBe(12);
  useSimulatorStore.getState().restart();
  expect(useSimulatorStore.getState().seed).toBe(123);
  expect(useSimulatorStore.getState().result).toBeNull();
  useSimulatorStore.getState().newSession();
  expect(useSimulatorStore.getState().seed).toBeNull();
});
