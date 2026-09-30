import { describe, it, expect } from 'vitest';
import { createTypingState, typingReducer, isValidKey } from '../typingReducer';

describe('isValidKey', () => {
  it('accepts lowercase a-z and space', () => {
    expect(isValidKey('a')).toBe(true);
    expect(isValidKey('z')).toBe(true);
    expect(isValidKey('m')).toBe(true);
    expect(isValidKey(' ')).toBe(true);
  });

  it('rejects uppercase, digits, punctuation, and control keys', () => {
    expect(isValidKey('A')).toBe(false);
    expect(isValidKey('Z')).toBe(false);
    expect(isValidKey('0')).toBe(false);
    expect(isValidKey('9')).toBe(false);
    expect(isValidKey('.')).toBe(false);
    expect(isValidKey(',')).toBe(false);
    expect(isValidKey('!')).toBe(false);
    expect(isValidKey('Shift')).toBe(false);
    expect(isValidKey('Enter')).toBe(false);
    expect(isValidKey('Backspace')).toBe(false);
    expect(isValidKey('ArrowLeft')).toBe(false);
    expect(isValidKey('Tab')).toBe(false);
    expect(isValidKey('')).toBe(false);
  });
});

describe('createTypingState', () => {
  it('initializes state for valid target text', () => {
    const state = createTypingState('type fight');
    expect(state.targetText).toBe('type fight');
    expect(state.cursorIndex).toBe(0);
    expect(state.totalKeypresses).toBe(0);
    expect(state.firstAttemptCorrect).toBe(0);
    expect(state.erroredAtCurrentIndex).toBe(false);
    expect(state.keystrokeLog).toEqual([]);
    expect(state.isComplete).toBe(false);
  });

  it('initializes empty target text as complete', () => {
    const state = createTypingState('');
    expect(state.isComplete).toBe(true);
    expect(state.cursorIndex).toBe(0);
  });

  it('throws an error if target text contains uppercase or non-charset characters', () => {
    expect(() => createTypingState('Type')).toThrow();
    expect(() => createTypingState('fight!')).toThrow();
    expect(() => createTypingState('123')).toThrow();
  });
});

describe('typingReducer', () => {
  // Test 1: Correct key advances the cursor
  it('advances cursor on correct keypress', () => {
    const s0 = createTypingState('cat');
    const s1 = typingReducer(s0, { key: 'c', timestamp: 100 });

    expect(s1.cursorIndex).toBe(1);
    expect(s1.totalKeypresses).toBe(1);
    expect(s1.firstAttemptCorrect).toBe(1);
    expect(s1.erroredAtCurrentIndex).toBe(false);
    expect(s1.isComplete).toBe(false);
  });

  // Test 2: Wrong key does not advance
  it('does not advance cursor on wrong keypress', () => {
    const s0 = createTypingState('cat');
    const s1 = typingReducer(s0, { key: 'x', timestamp: 100 });

    expect(s1.cursorIndex).toBe(0);
    expect(s1.isComplete).toBe(false);
  });

  // Test 3: Wrong key increments totalKeypresses but not firstAttemptCorrect
  it('increments totalKeypresses on wrong key but not firstAttemptCorrect', () => {
    const s0 = createTypingState('cat');
    const s1 = typingReducer(s0, { key: 'x', timestamp: 100 });

    expect(s1.totalKeypresses).toBe(1);
    expect(s1.firstAttemptCorrect).toBe(0);
    expect(s1.erroredAtCurrentIndex).toBe(true);
    expect(s1.keystrokeLog).toEqual([]);
  });

  // Test 4: Correct key after a wrong key at the same index advances but does NOT count as first-attempt correct
  it('advances on correct key after a wrong key, but does not count as first-attempt correct', () => {
    const s0 = createTypingState('cat');
    const s1 = typingReducer(s0, { key: 'z', timestamp: 100 }); // wrong key
    const s2 = typingReducer(s1, { key: 'c', timestamp: 200 }); // correct key

    expect(s2.cursorIndex).toBe(1);
    expect(s2.totalKeypresses).toBe(2);
    expect(s2.firstAttemptCorrect).toBe(0); // missed first attempt
    expect(s2.erroredAtCurrentIndex).toBe(false); // resets on advance
    expect(s2.keystrokeLog).toEqual([{ index: 0, timestamp: 200 }]);
  });

  // Test 5: Two wrong keys at the same index count as two keypresses
  it('counts two wrong keys at the same index as two keypresses', () => {
    const s0 = createTypingState('cat');
    const s1 = typingReducer(s0, { key: 'a', timestamp: 100 });
    const s2 = typingReducer(s1, { key: 'b', timestamp: 150 });

    expect(s2.cursorIndex).toBe(0);
    expect(s2.totalKeypresses).toBe(2);
    expect(s2.firstAttemptCorrect).toBe(0);
    expect(s2.erroredAtCurrentIndex).toBe(true);
  });

  // Test 6: Non-charset keys (Shift, '5', 'A', '.', Enter) change nothing at all
  it('ignores non-charset keys and changes nothing at all', () => {
    const s0 = createTypingState('cat');

    const nonCharsetKeys = ['Shift', '5', 'A', '.', 'Enter', 'Backspace', 'ArrowRight', 'Control'];
    const current = s0;

    for (const key of nonCharsetKeys) {
      const next = typingReducer(current, { key, timestamp: 50 });
      expect(next).toBe(current); // reference equality: unchanged
    }

    expect(current.cursorIndex).toBe(0);
    expect(current.totalKeypresses).toBe(0);
    expect(current.firstAttemptCorrect).toBe(0);
    expect(current.erroredAtCurrentIndex).toBe(false);
    expect(current.keystrokeLog).toEqual([]);
  });

  // Test 7: Space is typed like any other character
  it('treats space character like any other character', () => {
    const s0 = createTypingState('a b');
    const s1 = typingReducer(s0, { key: 'a', timestamp: 10 });
    expect(s1.cursorIndex).toBe(1);

    // Wrong key instead of space
    const s2Wrong = typingReducer(s1, { key: 'x', timestamp: 20 });
    expect(s2Wrong.cursorIndex).toBe(1);
    expect(s2Wrong.totalKeypresses).toBe(2);
    expect(s2Wrong.erroredAtCurrentIndex).toBe(true);

    // Correct space key advances cursor to 2
    const s2Correct = typingReducer(s2Wrong, { key: ' ', timestamp: 30 });
    expect(s2Correct.cursorIndex).toBe(2);
    expect(s2Correct.totalKeypresses).toBe(3);
    expect(s2Correct.erroredAtCurrentIndex).toBe(false);
  });

  // Test 8: isComplete flips only after the final character
  it('flips isComplete to true only after the final character', () => {
    const s0 = createTypingState('go');
    expect(s0.isComplete).toBe(false);

    const s1 = typingReducer(s0, { key: 'g', timestamp: 100 });
    expect(s1.cursorIndex).toBe(1);
    expect(s1.isComplete).toBe(false);

    const s2 = typingReducer(s1, { key: 'o', timestamp: 200 });
    expect(s2.cursorIndex).toBe(2);
    expect(s2.isComplete).toBe(true);
  });

  // Test 9: Input after completion is a no-op
  it('treats input after completion as a no-op', () => {
    const s0 = createTypingState('a');
    const s1 = typingReducer(s0, { key: 'a', timestamp: 100 });
    expect(s1.isComplete).toBe(true);

    const s2 = typingReducer(s1, { key: 'a', timestamp: 200 });
    const s3 = typingReducer(s1, { key: 'b', timestamp: 300 });

    expect(s2).toBe(s1);
    expect(s3).toBe(s1);
    expect(s1.totalKeypresses).toBe(1);
  });

  // Test 10: keystrokeLog records one entry per advance with the passed timestamp
  it('records one entry in keystrokeLog per advance with the passed timestamp', () => {
    const s0 = createTypingState('hi');

    const s1 = typingReducer(s0, { key: 'x', timestamp: 50 }); // wrong
    const s2 = typingReducer(s1, { key: 'h', timestamp: 100 }); // correct advance
    const s3 = typingReducer(s2, { key: 'y', timestamp: 150 }); // wrong
    const s4 = typingReducer(s3, { key: 'z', timestamp: 200 }); // wrong
    const s5 = typingReducer(s4, { key: 'i', timestamp: 250 }); // correct advance

    expect(s5.keystrokeLog).toEqual([
      { index: 0, timestamp: 100 },
      { index: 1, timestamp: 250 },
    ]);
  });

  // Test 11: A full run of a short text produces the expected final counters
  it('produces expected final counters for a full run with errors and advances', () => {
    const target = 'type fight';
    let state = createTypingState(target);

    // Sequence of key inputs:
    // 't' (ok: first try)
    // 'y' (ok: first try)
    // 'x' (err at index 2)
    // 'p' (ok: second try at index 2)
    // 'e' (ok: first try)
    // ' ' (ok: first try)
    // 'f' (ok: first try)
    // 'i' (ok: first try)
    // 'g' (ok: first try)
    // 'w' (err at index 8)
    // 'q' (err at index 8)
    // 'h' (ok: third try at index 8)
    // 't' (ok: first try)
    const inputs = [
      { key: 't', timestamp: 100 },
      { key: 'y', timestamp: 200 },
      { key: 'x', timestamp: 250 }, // wrong
      { key: 'p', timestamp: 300 },
      { key: 'e', timestamp: 400 },
      { key: ' ', timestamp: 500 },
      { key: 'f', timestamp: 600 },
      { key: 'i', timestamp: 700 },
      { key: 'g', timestamp: 800 },
      { key: 'w', timestamp: 850 }, // wrong
      { key: 'q', timestamp: 880 }, // wrong
      { key: 'h', timestamp: 900 },
      { key: 't', timestamp: 1000 },
    ];

    for (const input of inputs) {
      state = typingReducer(state, input);
    }

    expect(state.isComplete).toBe(true);
    expect(state.cursorIndex).toBe(10);
    // Total keypresses: 10 correct + 3 wrong = 13
    expect(state.totalKeypresses).toBe(13);
    // 10 chars total, 2 chars had prior errors (indices 2 and 8), so 8 first-attempt correct
    expect(state.firstAttemptCorrect).toBe(8);
    expect(state.erroredAtCurrentIndex).toBe(false);
    expect(state.keystrokeLog).toHaveLength(10);
    expect(state.keystrokeLog[0]).toEqual({ index: 0, timestamp: 100 });
    expect(state.keystrokeLog[9]).toEqual({ index: 9, timestamp: 1000 });
  });

  // Immutability test
  it('does not mutate original state or previous logs', () => {
    const s0 = createTypingState('abc');
    const s1 = typingReducer(s0, { key: 'a', timestamp: 100 });

    expect(s0.cursorIndex).toBe(0);
    expect(s0.totalKeypresses).toBe(0);
    expect(s0.keystrokeLog).toEqual([]);
    expect(s1).not.toBe(s0);
  });
});
