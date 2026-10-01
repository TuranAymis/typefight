import {
  createTypingState,
  typingReducer,
  type KeyEvent,
  type TypingState,
} from '@typefight/engine';
import { DEFAULT_PRACTICE_TEXT } from '../store/useTypingStore';
import { attachKeyboardInput, type InputWarning, type KeyboardInput } from './keyboardInput';

const WARNING_MESSAGES: Record<InputWarning, string> = {
  paste: 'Yapıştırmaya izin verilmiyor.',
  drop: 'Sürükleyip bırakmaya izin verilmiyor.',
  cut: 'Kesmeye izin verilmiyor.',
  composition: 'IME girişi desteklenmiyor.',
};

export interface SurfaceSnapshot {
  readonly typingState: TypingState;
  readonly typedBuffer: string;
  readonly events: readonly KeyEvent[];
  readonly isComposing: boolean;
  readonly warning: string | null;
}

export const createTypingSurface = (
  targetText = DEFAULT_PRACTICE_TEXT,
  schedule: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  cancel: (id: number) => void = cancelAnimationFrame,
) => {
  let typingState = createTypingState(targetText);
  let typedBuffer = '';
  let events: KeyEvent[] = [];
  let isComposing = false;
  let warning: string | null = null;
  let snapshot: SurfaceSnapshot = { typingState, typedBuffer, events, isComposing, warning };
  let frame: number | null = null;
  let input: KeyboardInput | null = null;
  const listeners = new Set<() => void>();
  const publish = () => {
    frame = null;
    snapshot = { typingState, typedBuffer, events: [...events], isComposing, warning };
    listeners.forEach((listener) => listener());
  };
  const invalidate = () => {
    if (frame === null) frame = schedule(publish);
  };
  const connect = (element: EventTarget) => {
    input?.dispose();
    input = attachKeyboardInput(element, {
      onKey(entry) {
        events.push(entry);
        if (entry.key === 'Backspace') typedBuffer = typedBuffer.slice(0, -1);
        else typedBuffer += entry.key;
        typingState = typingReducer(typingState, { key: entry.key, timestamp: entry.t });
        invalidate();
      },
      onWarning(reason) {
        warning = WARNING_MESSAGES[reason];
        invalidate();
      },
      onCompositionChange(value) {
        isComposing = value;
        invalidate();
      },
    });
    return () => {
      input?.dispose();
      input = null;
    };
  };
  return {
    connect,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset(text = targetText) {
      input?.reset();
      typingState = createTypingState(text);
      typedBuffer = '';
      events = [];
      warning = null;
      if (frame !== null) {
        cancel(frame);
        frame = null;
      }
      publish();
    },
    dispose() {
      input?.dispose();
      if (frame !== null) {
        cancel(frame);
        frame = null;
      }
    },
  };
};
