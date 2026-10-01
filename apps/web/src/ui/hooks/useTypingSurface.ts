import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createTypingSurface } from '../../input/typingSurface';

export const useTypingSurface = () => {
  const surface = useRef<ReturnType<typeof createTypingSurface> | null>(null);
  if (surface.current === null) surface.current = createTypingSurface();
  const current = surface.current;
  const snapshot = useSyncExternalStore(current.subscribe, current.getSnapshot);
  const elementRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const disconnect = current.connect(element);
    element.focus();
    return () => {
      disconnect();
      current.dispose();
    };
  }, [current]);
  return {
    ...snapshot,
    elementRef,
    reset: () => {
      current.reset();
      elementRef.current?.focus();
    },
  };
};
