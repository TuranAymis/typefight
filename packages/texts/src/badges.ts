export interface BadgeDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

/**
 * The ten starter badges. Ids are stored in the database, so never rename or reuse one; new badges
 * are appended.
 */
export const BADGES: readonly BadgeDefinition[] = [
  { id: 'first-duel', name: 'First Duel', description: 'Finish your first duel.' },
  { id: 'first-win', name: 'First Win', description: 'Win a duel.' },
  { id: 'wins-10', name: 'Ten Wins', description: 'Win 10 duels.' },
  { id: 'wins-50', name: 'Fifty Wins', description: 'Win 50 duels.' },
  { id: 'wpm-50', name: '50 WPM', description: 'Reach 50 WPM in a verified run.' },
  { id: 'wpm-75', name: '75 WPM', description: 'Reach 75 WPM in a verified run.' },
  { id: 'wpm-100', name: '100 WPM', description: 'Reach 100 WPM in a verified run.' },
  { id: 'wpm-120', name: '120 WPM', description: 'Reach 120 WPM in a verified run.' },
  {
    id: 'accuracy-95',
    name: 'Sharp Shooter',
    description: 'Finish a verified run of at least 10 seconds with 95% accuracy.',
  },
  {
    id: 'accuracy-99',
    name: 'Flawless',
    description: 'Finish a verified run of at least 10 seconds with 99% accuracy.',
  },
];

/** A run must last this long to count for accuracy badges, so a three second sprint cannot earn them. */
export const BADGE_MIN_ACCURACY_RUN_MS = 10_000;
