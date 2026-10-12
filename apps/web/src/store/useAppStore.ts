import { create } from 'zustand';

export type Screen = 'menu' | 'simulator' | 'gauntlet' | 'results';
export type MotionSetting = 'system' | 'reduced' | 'full';

export const getEffectiveMotion = (
  setting: MotionSetting,
  systemReduced: boolean,
): 'reduced' | 'full' => (setting === 'system' ? (systemReduced ? 'reduced' : 'full') : setting);

export interface AppState {
  currentScreen: Screen;
  motionSetting: MotionSetting;
  setScreen: (screen: Screen) => void;
  setMotionSetting: (setting: MotionSetting) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentScreen: 'menu',
  motionSetting: 'system',
  setScreen: (screen: Screen) => set({ currentScreen: screen }),
  setMotionSetting: (setting: MotionSetting) => set({ motionSetting: setting }),
}));
