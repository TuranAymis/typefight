import type { Locale } from '@typefight/engine';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { playSound } from '../../audio';
import { createTypingSurface } from '../../input/typingSurface';
import { useIdentityStore } from '../../store/useIdentityStore';

export const useTypingSurface = () => {
  const cursorEffect = useIdentityStore((state) => state.cursorEffect);
  const surface = useRef<ReturnType<typeof createTypingSurface> | null>(null);
  if (surface.current === null) surface.current = createTypingSurface();
  const current = surface.current;
  const snapshot = useSyncExternalStore(current.subscribe, current.getSnapshot);
  const elementRef = useRef<HTMLDivElement>(null);
  // One click per keypress. Comparing with the previous count also ignores resets and re-renders.
  const keypresses = snapshot.typingState.totalKeypresses;
  const lastKeypresses = useRef(keypresses);
  useEffect(() => {
    if (keypresses > lastKeypresses.current) playSound('key');
    lastKeypresses.current = keypresses;
  }, [keypresses]);
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
    cursorEffect,
    elementRef,
    reset: (text?: string, locale?: Locale) => {
      current.reset(text, locale);
      elementRef.current?.focus();
    },
  };
};
