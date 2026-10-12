import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore, getEffectiveMotion } from '../../store/useAppStore';
import { readReducedMotion, subscribeReducedMotion, useReducedMotion } from './useReducedMotion';

const originalWindow = globalThis.window;

const Probe = () => <span>{useReducedMotion() ? 'reduced' : 'full'}</span>;

afterEach(() => {
  vi.unstubAllGlobals();
  useAppStore.setState({ motionSetting: 'system' });
});

describe('useReducedMotion', () => {
  it('reads a mocked system preference and supports a store override', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const media = {
      matches: true,
      addEventListener,
      removeEventListener,
    } as unknown as MediaQueryList;
    vi.stubGlobal('window', { matchMedia: vi.fn(() => media) });
    expect(readReducedMotion()).toBe(true);
    expect(renderToStaticMarkup(<Probe />)).toContain('reduced');
    expect(getEffectiveMotion(useAppStore.getState().motionSetting, true)).toBe('reduced');
    useAppStore.getState().setMotionSetting('full');
    expect(getEffectiveMotion(useAppStore.getState().motionSetting, true)).toBe('full');
    useAppStore.getState().setMotionSetting('reduced');
    expect(getEffectiveMotion(useAppStore.getState().motionSetting, false)).toBe('reduced');
  });

  it('subscribes to preference changes and cleans up', () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const media = {
      matches: false,
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.add(listener),
      ),
      removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
      ),
    } as unknown as MediaQueryList;
    vi.stubGlobal('window', { matchMedia: vi.fn(() => media) });
    const onChange = vi.fn();
    const unsubscribe = subscribeReducedMotion(onChange);
    for (const listener of listeners) listener({ matches: true } as MediaQueryListEvent);
    expect(onChange).toHaveBeenCalledWith(true);
    unsubscribe();
    expect(listeners.size).toBe(0);
  });

  it('is safe without window', () => {
    vi.stubGlobal('window', undefined);
    expect(readReducedMotion()).toBe(false);
    expect(renderToStaticMarkup(<Probe />)).toContain('full');
    vi.stubGlobal('window', originalWindow);
  });
});
