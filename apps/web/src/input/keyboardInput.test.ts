import { describe, expect, it } from 'vitest';
import { computeResult, normalizeTypedText, RECORD_VERSION } from '@typefight/engine';
import { attachKeyboardInput } from './keyboardInput';

const keydown = (surface: EventTarget, key: string, options: Record<string, unknown> = {}) => {
  const event = new Event('keydown', { cancelable: true });
  Object.assign(
    event,
    {
      key,
      code: 'KeyZ',
      repeat: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      isComposing: false,
    },
    options,
  );
  surface.dispatchEvent(event);
  return event;
};

describe('keyboard input', () => {
  it('records ordered relative key events using event.key and filters shortcuts and repeats', () => {
    const surface = new EventTarget();
    let time = 100;
    const received: string[] = [];
    const input = attachKeyboardInput(surface, {
      now: () => time,
      onKey: (entry) => received.push(entry.key),
    });
    time = 110;
    keydown(surface, 'a');
    time = 120;
    keydown(surface, 'Space');
    keydown(surface, 'Backspace');
    keydown(surface, 'b', { repeat: true });
    keydown(surface, 'c', { ctrlKey: true });
    keydown(surface, 'ArrowLeft');
    expect(input.events).toEqual([
      { t: 10, key: 'a' },
      { t: 20, key: ' ' },
      { t: 20, key: 'Backspace' },
    ]);
    expect(received).toEqual(['a', ' ', 'Backspace']);
    input.dispose();
  });

  it('blocks clipboard, drop and IME without scoring their contents', () => {
    const surface = new EventTarget();
    const warnings: string[] = [];
    const input = attachKeyboardInput(surface, {
      now: () => 0,
      onKey: () => {},
      onWarning: (warning) => warnings.push(warning),
    });
    for (const type of ['paste', 'drop', 'cut']) {
      const event = new Event(type, { cancelable: true });
      surface.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    surface.dispatchEvent(new Event('compositionstart', { cancelable: true }));
    expect(input.isComposing).toBe(true);
    keydown(surface, 'a');
    surface.dispatchEvent(new Event('compositionend', { cancelable: true }));
    expect(input.isComposing).toBe(false);
    keydown(surface, 'Process');
    expect(input.events).toEqual([]);
    expect(warnings).toEqual(['paste', 'drop', 'cut', 'composition']);
    input.dispose();
  });

  it.each([
    ['Turkish Q', 'KeyQ'],
    ['Turkish F', 'KeyF'],
  ])('%s uses characters rather than physical key codes for Turkish scoring', (_layout, code) => {
    const surface = new EventTarget();
    let time = 0;
    const input = attachKeyboardInput(surface, {
      locale: 'tr',
      now: () => time,
      onKey: () => {},
    });
    const typed = ['ı', 'I', 'i', 'İ', 'ç', 'ğ', 'ö', 'ş', 'ü'];
    for (const key of typed) {
      time += 100;
      keydown(surface, key, { code });
    }
    expect(input.events.map((event) => event.key).join('')).toBe('ııiiçğöşü');
    expect(normalizeTypedText('Iİ', 'tr')).toBe('ıi');
    const result = computeResult({
      version: RECORD_VERSION,
      targetText: 'ııiiçğöşü',
      locale: 'tr',
      events: input.events,
      durationMs: time,
    });
    expect(result.correctChars).toBe(9);
    expect(result.accuracy).toBe(100);
    input.dispose();
  });
});
