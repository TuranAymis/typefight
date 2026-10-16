/**
 * The only analytics events TypeFight records, and the only properties each may carry.
 * Every property is an enum of fixed strings: no free text, no numbers, nothing that could identify
 * a player (no nickname, no typed text). The web client and the API both validate against this.
 */
export const ANALYTICS_EVENTS = {
  game_open: {},
  sim_started: { lang: ['en', 'tr'] },
  sim_completed: { lang: ['en', 'tr'] },
  duel_started: { lang: ['en', 'tr'], opponent: ['bot', 'ghost'] },
  duel_completed: {
    lang: ['en', 'tr'],
    winner: ['player', 'opponent', 'draw'],
    reason: ['ko', 'hp', 'wpm', 'accuracy', 'draw'],
  },
  rematch: { lang: ['en', 'tr'] },
  glitch_fired: { source: ['tutorial', 'duel'] },
} as const satisfies Record<string, Record<string, readonly string[]>>;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS;
export type AnalyticsProps = Readonly<Record<string, string>>;

/** Anonymous random id made on the device (16 random bytes as hex). It is not linked to a nickname. */
export const CLIENT_ID_PATTERN = /^[0-9a-f]{32}$/;
export const MAX_EVENTS_PER_REQUEST = 20;

export const isAnalyticsEventName = (value: unknown): value is AnalyticsEventName =>
  typeof value === 'string' && Object.hasOwn(ANALYTICS_EVENTS, value);

/**
 * Returns the properties when they match the event's schema exactly (same keys, every value one of
 * the allowed strings), otherwise null.
 */
export const validateEventProps = (
  name: AnalyticsEventName,
  props: unknown,
): AnalyticsProps | null => {
  const schema: Readonly<Record<string, readonly string[]>> = ANALYTICS_EVENTS[name];
  const given = props ?? {};
  if (typeof given !== 'object' || Array.isArray(given)) return null;
  const entries = Object.entries(given);
  const keys = Object.keys(schema);
  if (entries.length !== keys.length) return null;
  const clean: Record<string, string> = {};
  for (const [key, value] of entries) {
    // Own keys only: "constructor" and friends exist on every object but are not part of a schema.
    const allowed = Object.hasOwn(schema, key) ? schema[key] : undefined;
    if (!allowed || typeof value !== 'string' || !allowed.includes(value)) return null;
    clean[key] = value;
  }
  return clean;
};
