import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Keeps the line with the cursor as the middle line of a fixed three-line window: the container
 * scrolls (it has overflow hidden) so one finished line stays above, one upcoming line below.
 * The cursor element is found through the `data-cursor` attribute. `trigger` is anything that
 * changes when the cursor moves.
 */
export const useCenteredLine = (
  container: RefObject<HTMLElement | null>,
  trigger: unknown,
): void => {
  useLayoutEffect(() => {
    const element = container.current;
    const cursor = element?.querySelector<HTMLElement>('[data-cursor]');
    if (!element || !cursor) return;
    const lineHeight = parseFloat(getComputedStyle(cursor).lineHeight) || cursor.offsetHeight;
    element.scrollTop = Math.max(0, cursor.offsetTop - lineHeight);
  }, [container, trigger]);
};
