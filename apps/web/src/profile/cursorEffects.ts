import { CURSOR_EFFECTS } from '@typefight/texts';

export const resolveCursorEffect = (
  effectId: unknown,
  badges: readonly { readonly id: string }[],
): string => {
  const effect = CURSOR_EFFECTS.find(({ id }) => id === effectId);
  return effect &&
    (effect.unlockBadgeId === null || badges.some(({ id }) => id === effect.unlockBadgeId))
    ? effect.id
    : 'default';
};
