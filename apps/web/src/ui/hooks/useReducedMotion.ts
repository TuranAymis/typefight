import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export const readReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false;

export const subscribeReducedMotion = (onChange: (reduced: boolean) => void): (() => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(QUERY);
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
};

export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(readReducedMotion);

  useEffect(() => {
    setReduced(readReducedMotion());
    return subscribeReducedMotion(setReduced);
  }, []);

  return reduced;
};
