/** Nickname rules shared by the web client (instant feedback) and the API (the real check). */

export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 16;

export type NicknameError = 'too_short' | 'too_long' | 'invalid_chars' | 'profanity';

export type NicknameCheck =
  | { readonly ok: true; readonly nickname: string }
  | { readonly ok: false; readonly error: NicknameError };

// Letters (incl. Turkish), digits, underscore and hyphen; no spaces so names cannot be faked by padding.
const ALLOWED = /^[A-Za-z0-9ÇĞİÖŞÜçğıöşü_-]+$/;

// Deliberately small starter list (TR + EN); matched against a normalised, de-leeted form.
const BLOCKED_STEMS: readonly string[] = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'asshole',
  'dick',
  'pussy',
  'nigg',
  'fag',
  'rape',
  'nazi',
  'hitler',
  'amk',
  'aq',
  'orospu',
  'orosbu',
  'siktir',
  'sikik',
  'sikeyim',
  'yarrak',
  'yarak',
  'piç',
  'pic',
  'ibne',
  'gavat',
  'pezevenk',
  'götveren',
  'gotveren',
  'amcık',
  'amcik',
  'mal',
];

// Stems that are short enough to appear inside innocent words are only blocked as whole words.
const WHOLE_WORD_ONLY = new Set(['aq', 'amk', 'mal', 'pic', 'piç', 'dick', 'fag', 'rape']);

const LEET: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

/** Lower-cases the Turkish-aware way, undoes common leetspeak and drops separators. */
const normalize = (value: string): string => {
  const lowered = value.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
  const unleeted = [...lowered].map((char) => LEET[char] ?? char).join('');
  return unleeted.replace(/[_-]/g, '');
};

const foldTurkish = (value: string): string =>
  value
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u');

export const containsProfanity = (value: string): boolean => {
  const normalized = foldTurkish(normalize(value));
  // Whole-word matching is checked against the raw parts split on separators too.
  const words = foldTurkish(value.toLowerCase().replace(/İ/g, 'i'))
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
  return BLOCKED_STEMS.some((stem) => {
    const folded = foldTurkish(stem);
    if (WHOLE_WORD_ONLY.has(stem)) {
      return normalized === folded || words.includes(folded);
    }
    return normalized.includes(folded);
  });
};

export const validateNickname = (raw: string): NicknameCheck => {
  const nickname = raw.trim();
  if ([...nickname].length < NICKNAME_MIN_LENGTH) return { ok: false, error: 'too_short' };
  if ([...nickname].length > NICKNAME_MAX_LENGTH) return { ok: false, error: 'too_long' };
  if (!ALLOWED.test(nickname)) return { ok: false, error: 'invalid_chars' };
  if (containsProfanity(nickname)) return { ok: false, error: 'profanity' };
  return { ok: true, nickname };
};
