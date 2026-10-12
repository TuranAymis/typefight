import type { TextPassage } from './types';

/** Starter practice passages. The server picks one per session; the client never chooses its own. */
export const TEXT_POOL: readonly TextPassage[] = [
  {
    id: 'en-001',
    lang: 'en',
    text: 'the quick brown fox jumps over the lazy dog while the sun sets slowly behind the hills',
  },
  {
    id: 'en-002',
    lang: 'en',
    text: 'a steady hand and a calm mind will always beat a fast hand and a nervous heart',
  },
  {
    id: 'en-003',
    lang: 'en',
    text: 'small steps every day add up to a long journey and the road feels shorter with company',
  },
  {
    id: 'en-004',
    lang: 'en',
    text: 'the library was quiet except for the soft sound of pages turning and rain on the windows',
  },
  {
    id: 'tr-001',
    lang: 'tr',
    text: 'hızlı kahverengi tilki tembel köpeğin üzerinden atlarken güneş tepelerin ardında yavaşça batıyordu',
  },
  {
    id: 'tr-002',
    lang: 'tr',
    text: 'sakin bir zihin ve sabit bir el her zaman telaşlı bir kalbe ve aceleci parmaklara üstün gelir',
  },
  {
    id: 'tr-003',
    lang: 'tr',
    text: 'her gün atılan küçük adımlar uzun bir yolculuğa dönüşür ve yol arkadaşla çok daha kısa görünür',
  },
  {
    id: 'tr-004',
    lang: 'tr',
    text: 'kütüphane sessizdi yalnızca sayfaların çevrilişi ve camlara vuran yağmurun sesi duyuluyordu',
  },
];

export const pickPassage = (lang: 'en' | 'tr', index: number): TextPassage => {
  const candidates = TEXT_POOL.filter((passage) => passage.lang === lang);
  const picked = candidates[Math.abs(Math.trunc(index)) % candidates.length];
  if (!picked) throw new Error(`No passages for language ${lang}`);
  return picked;
};

export const findPassage = (id: string): TextPassage | undefined =>
  TEXT_POOL.find((passage) => passage.id === id);
