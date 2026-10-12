import { describe, expect, it } from 'vitest';
import { TEXT_POOL, pickPassage } from './index';
import { containsProfanity, validateNickname } from './nickname';

describe('validateNickname', () => {
  it('accepts normal names, including Turkish letters, and trims', () => {
    expect(validateNickname('  Çağrı_42 ')).toEqual({ ok: true, nickname: 'Çağrı_42' });
    expect(validateNickname('Fast-Typer')).toEqual({ ok: true, nickname: 'Fast-Typer' });
  });

  it('enforces length and character rules', () => {
    expect(validateNickname('ab')).toEqual({ ok: false, error: 'too_short' });
    expect(validateNickname('a'.repeat(17))).toEqual({ ok: false, error: 'too_long' });
    expect(validateNickname('a b c')).toEqual({ ok: false, error: 'invalid_chars' });
    expect(validateNickname('<script>')).toEqual({ ok: false, error: 'invalid_chars' });
  });

  it('rejects profanity in Turkish and English, also leetspeak and separators', () => {
    for (const name of [
      'SIKTIR',
      'siktir_git',
      'f.u'.replace('.', '_') + 'ck',
      'sh1t',
      'OROSPU',
      'amk',
    ]) {
      expect(validateNickname(name), name).toMatchObject({ ok: false, error: 'profanity' });
    }
  });

  it('does not block innocent words that merely contain a short stem', () => {
    for (const name of ['Malcolm', 'Picasso', 'Dickens', 'Aquarius', 'Amkara', 'Rapeseed1']) {
      expect(containsProfanity(name), name).toBe(false);
    }
  });
});

describe('text pool', () => {
  it('has passages for both languages and picks deterministically', () => {
    expect(TEXT_POOL.some((p) => p.lang === 'tr')).toBe(true);
    expect(pickPassage('en', 7)).toEqual(pickPassage('en', 7));
    expect(pickPassage('tr', 2 ** 32 - 1).lang).toBe('tr');
  });

  it('uses only characters the Turkish typing rules accept', () => {
    for (const passage of TEXT_POOL) {
      expect(passage.text).toBe(passage.text.trim());
      expect(passage.text).not.toMatch(/[A-ZÇĞİÖŞÜ]/);
    }
  });
});
