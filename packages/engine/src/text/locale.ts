export type Locale = 'en' | 'tr';

// Locale case mapping depends on ICU; Node 22 includes full ICU.
export const normalizeTypedText = (text: string, locale: Locale): string =>
  text.toLocaleLowerCase(locale);

export const isTypableChar = (char: string, locale: Locale): boolean =>
  char.length === 1 &&
  ((char >= 'a' && char <= 'z') || char === ' ' || (locale === 'tr' && 'çğıöşü'.includes(char)));
