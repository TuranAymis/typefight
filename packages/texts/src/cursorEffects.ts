import data from './cursor-effects.json';

export interface CursorEffectDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly unlockBadgeId: string | null;
}

export const CURSOR_EFFECTS: readonly CursorEffectDefinition[] = data;
