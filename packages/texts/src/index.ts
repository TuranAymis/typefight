import englishWords from './words/en.json';
import turkishWords from './words/tr.json';

export type { WordListTierMetadata, ContentManifest } from './types';
export const SIMULATOR_WORDS = { en: englishWords, tr: turkishWords } as const;
