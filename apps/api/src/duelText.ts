import { applyGlitches, placeGlitches, type DuelGlitch } from '@typefight/engine';
import { GLITCH_CONFIG, TEXT_POOL, type TextPassage } from '@typefight/texts';

/** A new text namespace keeps old sessions and bot records immutable. */
export const glitchPassage = (passage: TextPassage): TextPassage & { glitch: DuelGlitch } => {
  const version = GLITCH_CONFIG.version;
  const applied = applyGlitches(
    passage.text,
    placeGlitches({
      textId: passage.id,
      seed: `${passage.lang}:glitch-v${version}`,
      targetText: passage.text,
    }),
  );
  return {
    ...passage,
    id: `${passage.id}:glitch-v${version}`,
    text: applied.text,
    glitch: { version, markers: applied.markers },
  };
};

/** Only server-owned IDs and text can enable glitch rules, never submitted metadata. */
export const glitchForText = (
  id: string,
  text: string,
  lang: 'en' | 'tr',
): DuelGlitch | undefined => {
  const base = TEXT_POOL.find(
    (entry) => entry.lang === lang && `${entry.id}:glitch-v${GLITCH_CONFIG.version}` === id,
  );
  if (!base) return undefined;
  const passage = glitchPassage(base);
  return passage.text === text ? passage.glitch : undefined;
};
