import { isTypableChar, normalizeTypedText, type KeyEvent, type Locale } from '@typefight/engine';

export type InputWarning = 'paste' | 'drop' | 'cut' | 'composition';

export interface KeyboardInputOptions {
  readonly locale?: Locale;
  readonly now?: () => number;
  readonly onKey: (event: KeyEvent) => void;
  readonly onWarning?: (warning: InputWarning) => void;
  readonly onCompositionChange?: (composing: boolean) => void;
}

export interface KeyboardInput {
  readonly events: readonly KeyEvent[];
  readonly isComposing: boolean;
  reset: () => void;
  dispose: () => void;
}

export const attachKeyboardInput = (
  surface: EventTarget,
  options: KeyboardInputOptions,
): KeyboardInput => {
  const now = options.now ?? (() => performance.now());
  const locale = options.locale ?? 'en';
  let start = now();
  let composing = false;
  const events: KeyEvent[] = [];

  const onKeyDown = (raw: Event) => {
    const event = raw as KeyboardEvent;
    if (
      composing ||
      event.isComposing ||
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const key = event.key === 'Space' || event.key === 'Spacebar' ? ' ' : event.key;
    const normalized = normalizeTypedText(key, locale);
    if (key !== 'Backspace' && !isTypableChar(normalized, locale)) return;
    event.preventDefault();
    const entry = { t: Math.max(0, now() - start), key: key === 'Backspace' ? key : normalized };
    events.push(entry);
    options.onKey(entry);
  };
  const block = (warning: InputWarning) => (event: Event) => {
    event.preventDefault();
    options.onWarning?.(warning);
  };
  const onPaste = block('paste');
  const onDrop = block('drop');
  const onCut = block('cut');
  const onCompositionStart = (event: Event) => {
    event.preventDefault();
    composing = true;
    options.onCompositionChange?.(true);
    options.onWarning?.('composition');
  };
  const onCompositionEnd = (event: Event) => {
    event.preventDefault();
    composing = false;
    options.onCompositionChange?.(false);
  };
  surface.addEventListener('keydown', onKeyDown);
  surface.addEventListener('paste', onPaste);
  surface.addEventListener('drop', onDrop);
  surface.addEventListener('cut', onCut);
  surface.addEventListener('compositionstart', onCompositionStart);
  surface.addEventListener('compositionend', onCompositionEnd);
  return {
    get events() {
      return events;
    },
    get isComposing() {
      return composing;
    },
    reset() {
      events.length = 0;
      start = now();
    },
    dispose() {
      surface.removeEventListener('keydown', onKeyDown);
      surface.removeEventListener('paste', onPaste);
      surface.removeEventListener('drop', onDrop);
      surface.removeEventListener('cut', onCut);
      surface.removeEventListener('compositionstart', onCompositionStart);
      surface.removeEventListener('compositionend', onCompositionEnd);
    },
  };
};
