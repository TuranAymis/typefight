import { expect, it } from 'vitest';
import { createTypingSurface } from './typingSurface';

it('publishes one UI snapshot for 200 keypresses in one frame', () => {
  const callbacks: FrameRequestCallback[] = [];
  const surface = createTypingSurface(
    'a'.repeat(200),
    (callback) => callbacks.push(callback) - 1,
    () => {},
  );
  const target = new EventTarget();
  const disconnect = surface.connect(target);
  let updates = 0;
  surface.subscribe(() => {
    updates += 1;
  });
  for (let index = 0; index < 200; index += 1) {
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, {
      key: 'a',
      repeat: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      isComposing: false,
    });
    target.dispatchEvent(event);
  }
  expect(callbacks).toHaveLength(1);
  expect(updates).toBe(0);
  callbacks[0]?.(0);
  expect(updates).toBe(1);
  expect(surface.getSnapshot().typingState.cursorIndex).toBe(200);
  expect(surface.getSnapshot().events).toHaveLength(200);
  disconnect();
});
