import { describe, expect, it } from 'vitest';
import { ONBOARDING } from './onboarding';

const text = ONBOARDING.segments.map((segment) => segment.text).join('');

describe('onboarding content', () => {
  it('has exactly three beats with a caption of at most eight words', () => {
    expect(ONBOARDING.segments).toHaveLength(3);
    for (const { caption } of ONBOARDING.segments) {
      expect(caption.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
    }
  });

  it('types lowercase a-z and spaces only and never ends on a space', () => {
    expect(text).toMatch(/^[a-z ]+$/);
    expect(text.endsWith(' ')).toBe(false);
    for (const { text: segment } of ONBOARDING.segments.slice(0, -1)) {
      expect(segment.endsWith(' ')).toBe(true);
    }
  });

  it('takes roughly 20 seconds at 35-40 WPM', () => {
    const secondsAt = (wpm: number) => (text.length / 5 / wpm) * 60;
    expect(secondsAt(40)).toBeGreaterThanOrEqual(18);
    expect(secondsAt(35)).toBeLessThanOrEqual(22);
  });

  it('lists segment start times that match a steady 37.5 WPM pace', () => {
    let chars = 0;
    for (const segment of ONBOARDING.segments) {
      const expected = (chars / 5 / 37.5) * 60 * 1000;
      expect(Math.abs(segment.expectedStartMs - expected)).toBeLessThanOrEqual(100);
      chars += segment.text.length;
    }
  });

  it('lets the player finish the dummy by the last word', () => {
    const words = text.split(' ').length;
    expect(words * ONBOARDING.damagePerWord).toBeGreaterThanOrEqual(ONBOARDING.maxHp);
    expect((words - 1) * ONBOARDING.damagePerWord).toBeLessThan(ONBOARDING.maxHp);
  });

  it('keeps the scripted glitch short', () => {
    expect(ONBOARDING.glitchDurationMs).toBeGreaterThan(0);
    expect(ONBOARDING.glitchDurationMs).toBeLessThanOrEqual(3000);
  });
});
