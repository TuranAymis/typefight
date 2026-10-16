import { CLIENT_ID_PATTERN } from '@typefight/texts';
import { runIdentityStorage } from './identityStorage';

const KEY = 'analyticsClientId';

const randomClientId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

/**
 * The anonymous analytics id of this browser: random, stored in IndexedDB (localStorage is not
 * allowed), never linked to a nickname. Returns null when storage is unavailable, so a visitor is
 * not counted as someone new on every page load.
 */
export const loadOrCreateClientId = async (): Promise<string | null> => {
  try {
    const stored: unknown = await runIdentityStorage('readonly', (store) => store.get(KEY));
    if (typeof stored === 'string' && CLIENT_ID_PATTERN.test(stored)) return stored;
    const created = randomClientId();
    await runIdentityStorage('readwrite', (store) => store.put(created, KEY));
    return created;
  } catch {
    return null;
  }
};
