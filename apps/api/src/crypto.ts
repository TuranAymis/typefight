const toHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/** 256 bits of randomness, hex encoded. Used for device tokens and session tokens. */
export const randomToken = (): string => toHex(crypto.getRandomValues(new Uint8Array(32)));

export const randomId = (): string => crypto.randomUUID();

export const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;

export const sha256Hex = async (value: string): Promise<string> =>
  toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
