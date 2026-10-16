import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_EVENTS,
  CLIENT_ID_PATTERN,
  isAnalyticsEventName,
  validateEventProps,
} from './analyticsEvents';

describe('analytics event schema', () => {
  it('knows exactly the seven events the metrics need', () => {
    expect(Object.keys(ANALYTICS_EVENTS).sort()).toEqual([
      'duel_completed',
      'duel_started',
      'game_open',
      'glitch_fired',
      'rematch',
      'sim_completed',
      'sim_started',
    ]);
  });

  it('only allows short enum values, never free text', () => {
    for (const schema of Object.values(ANALYTICS_EVENTS)) {
      for (const allowed of Object.values(schema)) {
        for (const value of allowed) expect(value).toMatch(/^[a-z]{2,10}$/);
      }
    }
  });

  it('recognises event names and rejects inherited or unknown ones', () => {
    expect(isAnalyticsEventName('duel_started')).toBe(true);
    expect(isAnalyticsEventName('toString')).toBe(false);
    expect(isAnalyticsEventName('page_view')).toBe(false);
    expect(isAnalyticsEventName(7)).toBe(false);
  });

  it('accepts props that match the schema exactly', () => {
    expect(validateEventProps('game_open', undefined)).toEqual({});
    expect(validateEventProps('game_open', {})).toEqual({});
    expect(validateEventProps('sim_started', { lang: 'tr' })).toEqual({ lang: 'tr' });
    expect(
      validateEventProps('duel_completed', { lang: 'en', winner: 'draw', reason: 'draw' }),
    ).toEqual({ lang: 'en', winner: 'draw', reason: 'draw' });
  });

  it('rejects extra keys, missing keys, wrong values and wrong shapes', () => {
    expect(validateEventProps('game_open', { nickname: 'Ada' })).toBeNull();
    expect(validateEventProps('sim_started', {})).toBeNull();
    expect(validateEventProps('sim_started', { lang: 'de' })).toBeNull();
    expect(validateEventProps('sim_started', { lang: 1 })).toBeNull();
    expect(validateEventProps('sim_started', { lang: 'en', extra: 'x' })).toBeNull();
    expect(validateEventProps('sim_started', 'en')).toBeNull();
    expect(validateEventProps('sim_started', ['en'])).toBeNull();
    expect(validateEventProps('sim_started', { constructor: 'en' })).toBeNull();
  });

  it('accepts only 32-hex client ids', () => {
    expect(CLIENT_ID_PATTERN.test('a'.repeat(32))).toBe(true);
    expect(CLIENT_ID_PATTERN.test('a'.repeat(31))).toBe(false);
    expect(CLIENT_ID_PATTERN.test('A'.repeat(32))).toBe(false);
    expect(CLIENT_ID_PATTERN.test('g'.repeat(32))).toBe(false);
  });
});
