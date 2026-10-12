const toHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/** 256 bits of randomness, hex encoded. Used for device tokens and session tokens. */
export const randomToken = (): string => toHex(crypto.getRandomValues(new Uint8Array(32)));

export const randomId = (): string => crypto.randomUUID();

export const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;

export const sha256Hex = async (value: string): Promise<string> =>
  toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));

// No 0/O/1/I/L so a code read off a screen or paper is hard to mistype.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** 20 characters from a 31 symbol alphabet (about 99 bits), written as XXXXX-XXXXX-XXXXX-XXXXX. */
export const randomRecoveryCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const chars = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]);
  return [0, 5, 10, 15].map((start) => chars.slice(start, start + 5).join('')).join('-');
};

/** Upper-cases and strips separators/spaces so pasted codes match whatever formatting was used. */
export const normalizeRecoveryCode = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '');
