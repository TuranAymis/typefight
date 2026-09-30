export const RECORD_VERSION = 1;

export interface KeyEvent {
  readonly t: number;
  readonly key: string;
}

export interface SessionRecord {
  readonly version: number;
  readonly targetText: string;
  readonly locale: 'en' | 'tr';
  readonly events: readonly KeyEvent[];
  readonly durationMs: number;
}

export interface SessionResult {
  readonly wpm: number;
  readonly rawWpm: number;
  readonly accuracy: number;
  readonly consistency: number;
  readonly typedChars: number;
  readonly correctChars: number;
  readonly errorChars: number;
  readonly uncorrectedErrors: number;
  readonly correctedErrors: number;
  readonly backspaces: number;
  readonly durationMs: number;
}

export interface DamageEvent {
  readonly t: number;
  readonly amount: number;
  readonly source: 'player' | 'opponent';
}
