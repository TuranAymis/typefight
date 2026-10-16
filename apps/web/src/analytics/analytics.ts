import {
  MAX_EVENTS_PER_REQUEST,
  validateEventProps,
  type AnalyticsEventName,
  type AnalyticsProps,
} from '@typefight/texts';

export interface QueuedEvent {
  readonly name: AnalyticsEventName;
  readonly props: AnalyticsProps;
}

export interface AnalyticsOptions {
  /** False when the player opted out (Do Not Track) or analytics is unavailable. Checked per event. */
  readonly enabled: () => boolean;
  /** The anonymous id of this device, or null when it cannot be stored (then nothing is sent). */
  readonly getClientId: () => Promise<string | null>;
  readonly send: (body: { clientId: string; events: readonly QueuedEvent[] }) => Promise<void>;
  /** Runs `callback` after `ms`; returns a function that cancels it. */
  readonly schedule: (callback: () => void, ms: number) => () => void;
  readonly flushAt?: number;
  readonly delayMs?: number;
  /** Events waiting beyond this are dropped oldest-first (a stuck network must not grow memory). */
  readonly maxQueue?: number;
}

export interface Analytics {
  track: (name: AnalyticsEventName, props?: AnalyticsProps) => void;
  flush: () => Promise<void>;
}

/**
 * Batches product events and sends them. It never throws and never blocks the game: a failed send
 * drops that batch. Events are checked against the shared schema before they are queued.
 */
export const createAnalytics = (options: AnalyticsOptions): Analytics => {
  const flushAt = Math.min(options.flushAt ?? 10, MAX_EVENTS_PER_REQUEST);
  const delayMs = options.delayMs ?? 2000;
  const maxQueue = options.maxQueue ?? 50;
  let queue: QueuedEvent[] = [];
  let cancelTimer: (() => void) | null = null;
  let sending: Promise<void> = Promise.resolve();

  const flush = (): Promise<void> => {
    cancelTimer?.();
    cancelTimer = null;
    if (queue.length === 0) return sending;
    const batch = queue.slice(0, MAX_EVENTS_PER_REQUEST);
    queue = queue.slice(MAX_EVENTS_PER_REQUEST);
    sending = sending.then(async () => {
      try {
        const clientId = await options.getClientId();
        if (clientId) await options.send({ clientId, events: batch });
      } catch {
        // Analytics is best effort.
      }
    });
    if (queue.length > 0) return flush();
    return sending;
  };

  const track = (name: AnalyticsEventName, props: AnalyticsProps = {}): void => {
    try {
      if (!options.enabled()) return;
      const clean = validateEventProps(name, props);
      if (!clean) return;
      queue.push({ name, props: clean });
      if (queue.length > maxQueue) queue = queue.slice(queue.length - maxQueue);
      if (queue.length >= flushAt) void flush();
      else cancelTimer ??= options.schedule(() => void flush(), delayMs);
    } catch {
      // Never let analytics break the game.
    }
  };

  return { track, flush };
};
