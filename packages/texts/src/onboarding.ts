import data from './onboarding.json';

export interface OnboardingContent {
  readonly maxHp: number;
  readonly damagePerWord: number;
  readonly glitchDurationMs: number;
  readonly opponentLabel: string;
  readonly demoLabel: string;
  readonly segments: readonly {
    readonly text: string;
    readonly caption: string;
    readonly expectedStartMs: number;
  }[];
}

export const ONBOARDING: OnboardingContent = data;
