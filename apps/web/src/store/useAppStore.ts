import { create } from 'zustand';

export type Screen = 'menu' | 'simulator' | 'gauntlet' | 'results';

export interface AppState {
  currentScreen: Screen;
  setScreen: (screen: Screen) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentScreen: 'menu',
  setScreen: (screen: Screen) => set({ currentScreen: screen }),
}));
