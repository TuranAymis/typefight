import { describe, expect, it } from 'vitest';
import { tutorialView } from '../onboarding';
import { createTypingState, typingReducer } from '../typingReducer';

const script = {
  maxHp: 100,
  damagePerWord: 10,
  glitchDurationMs: 2000,
  segments: [
    { text: 'ab cd ', caption: 'first' },
    { text: 'ef gh ', caption: 'second' },
    { text: 'ij kl', caption: 'third' },
  ],
};
const TEXT = script.segments.map((segment) => segment.text).join('');

const typeUpTo = (count: number, msPerKey = 100) => {
  let state = createTypingState(TEXT);
  for (let index = 0; index < count; index++) {
    state = typingReducer(state, { key: TEXT[index] ?? '', timestamp: (index + 1) * msPerKey });
  }
  return state;
};

describe('tutorialView', () => {
  it('starts on the first caption with full HP and no glitch', () => {
    const view = tutorialView(script, typeUpTo(0), 0);
    expect(view).toEqual({
      segment: 0,
      caption: 'first',
      hp: 100,
      completedWords: 0,
      glitchActive: false,
      complete: false,
    });
  });

  it('advances the caption at each segment boundary', () => {
    expect(tutorialView(script, typeUpTo(5), 500).caption).toBe('first');
    expect(tutorialView(script, typeUpTo(6), 600).caption).toBe('second');
    expect(tutorialView(script, typeUpTo(12), 1200).caption).toBe('third');
  });

  it('removes HP only when a word is finished, never below zero', () => {
    expect(tutorialView(script, typeUpTo(1), 100).hp).toBe(100);
    expect(tutorialView(script, typeUpTo(2), 200).hp).toBe(90);
    expect(tutorialView(script, typeUpTo(5), 500).hp).toBe(80);
    expect(tutorialView({ ...script, damagePerWord: 60 }, typeUpTo(11), 1100).hp).toBe(0);
  });

  it('shows the scripted glitch for its duration after the last segment starts', () => {
    const typed = typeUpTo(12);
    // The first key of the third segment was typed at t=1200 ms.
    expect(tutorialView(script, typeUpTo(11), 1100).glitchActive).toBe(false);
    expect(tutorialView(script, typed, 1200).glitchActive).toBe(true);
    expect(tutorialView(script, typed, 3199).glitchActive).toBe(true);
    expect(tutorialView(script, typed, 3200).glitchActive).toBe(false);
  });

  it('reports completion and stops the glitch', () => {
    const view = tutorialView(script, typeUpTo(TEXT.length), 1300);
    expect(view.complete).toBe(true);
    expect(view.glitchActive).toBe(false);
    expect(view.completedWords).toBe(6);
  });

  it('is a pure function of its inputs', () => {
    const typed = typeUpTo(8);
    expect(tutorialView(script, typed, 900)).toEqual(tutorialView(script, typed, 900));
  });
});
