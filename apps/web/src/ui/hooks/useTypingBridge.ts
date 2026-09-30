import { useEffect } from 'react';
import { isValidKey, type KeyInput } from '@typefight/engine';
import { useTypingStore } from '../../store';

/**
 * Keydown Bridge & rAF Render Loop
 *
 * Implements B3 and B4 from the roadmap:
 * - Single window-level keydown listener capturing input at timestamp = performance.now()
 * - Discards repeat events (event.repeat === true)
 * - Discards shortcuts (Ctrl/Alt/Meta held) and non-charset keys via isValidKey
 * - Calls preventDefault() only for consumed gameplay keys
 * - Pushes to an input buffer (reducer is never called directly inside keydown)
 * - Runs a requestAnimationFrame loop that drains the buffer and applies batched inputs
 *   ensuring exactly one state update/render per frame regardless of keystroke count.
 */
export const useTypingBridge = (active: boolean = true): void => {
  const applyBatch = useTypingStore((state) => state.applyBatch);

  useEffect(() => {
    if (!active) return;

    const inputBuffer: KeyInput[] = [];
    let animationFrameId: number;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 1. Key repeat rule: discard key repeats
      if (event.repeat) {
        return;
      }

      // 2. Shortcut protection: let browser shortcuts (Ctrl+R, Alt+Tab, Cmd+etc.) pass through
      if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      // 3. Charset rule: let engine's isValidKey decide without duplicating logic
      if (!isValidKey(event.key)) {
        return;
      }

      // 4. Game consumes this key: prevent default browser behavior (e.g. space scroll)
      event.preventDefault();

      // 5. Capture timestamp at the listener measurement point
      const timestamp = performance.now();

      // 6. Push to buffer for rAF loop
      inputBuffer.push({
        key: event.key,
        timestamp,
      });
    };

    // 7. Render loop: drain buffer once per animation frame
    const tick = () => {
      if (inputBuffer.length > 0) {
        const drained = inputBuffer.splice(0, inputBuffer.length);
        applyBatch(drained);
      }
      animationFrameId = window.requestAnimationFrame(tick);
    };

    window.addEventListener('keydown', handleKeyDown);
    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [active, applyBatch]);
};
