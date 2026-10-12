import { create } from 'zustand';
import type { SessionResult, TypingState, KeyEvent } from '@typefight/engine';
import {
  computeSimulatorResult,
  type SimulatorDuration,
  type SimulatorLocale,
} from '../ui/screens/simulatorHelpers';

export interface SimulatorResult {
  readonly metrics: SessionResult;
  readonly state: TypingState;
  readonly events: readonly KeyEvent[];
  readonly locale: SimulatorLocale;
  readonly duration: SimulatorDuration;
  readonly seed: number;
}

interface SimulatorStoreState {
  duration: SimulatorDuration;
  locale: SimulatorLocale;
  seed: number | null;
  result: SimulatorResult | null;
  setDuration: (duration: SimulatorDuration) => void;
  setLocale: (locale: SimulatorLocale) => void;
  start: (seed: number) => void;
  restart: () => void;
  newSession: () => void;
  finish: (state: TypingState, events: readonly KeyEvent[], elapsedMs: number) => void;
}

export const useSimulatorStore = create<SimulatorStoreState>((set) => ({
  duration: 30,
  locale: 'en',
  seed: null,
  result: null,
  setDuration: (duration) => set({ duration }),
  setLocale: (locale) => set({ locale }),
  start: (seed) => set({ seed, result: null }),
  restart: () => set({ result: null }),
  newSession: () => set({ seed: null, result: null }),
  finish: (state, events, elapsedMs) =>
    set((current) => {
      if (current.seed === null || current.result) return current;
      const metrics = computeSimulatorResult(state, elapsedMs, current.locale);
      return {
        result: {
          metrics,
          state,
          events,
          locale: current.locale,
          duration: current.duration,
          seed: current.seed,
        },
      };
    }),
}));
