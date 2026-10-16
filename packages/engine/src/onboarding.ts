import type { TypingState } from './typingTypes';

interface TutorialScript {
  readonly maxHp: number;
  readonly damagePerWord: number;
  readonly glitchDurationMs: number;
  readonly segments: readonly { readonly text: string; readonly caption: string }[];
}

/** Uses blocking reducer progress and its injected keystroke clock, never ambient time. */
export const tutorialView = (script: TutorialScript, typing: TypingState, now: number) => {
  let boundary = 0;
  let segment = 0;
  for (let i = 0; i < script.segments.length - 1; i++) {
    boundary += script.segments[i]?.text.length ?? 0;
    if (typing.cursorIndex >= boundary) segment = i + 1;
  }
  const glitchBoundary = script.segments
    .slice(0, -1)
    .reduce((sum, part) => sum + part.text.length, 0);
  const glitchStart = typing.keystrokeLog[glitchBoundary - 1]?.timestamp;
  const completedWords = [...typing.targetText].filter(
    (char, index) =>
      char !== ' ' &&
      (typing.targetText[index + 1] === ' ' || index + 1 === typing.targetText.length) &&
      index < typing.cursorIndex,
  ).length;
  return {
    segment,
    caption: script.segments[segment]?.caption ?? '',
    hp: Math.max(0, script.maxHp - completedWords * script.damagePerWord),
    completedWords,
    glitchActive:
      glitchStart !== undefined &&
      now >= glitchStart &&
      now < glitchStart + script.glitchDurationMs &&
      !typing.isComplete,
    complete: typing.isComplete,
  };
};
