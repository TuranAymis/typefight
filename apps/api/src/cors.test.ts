import { describe, expect, it } from 'vitest';
import { originAllowed } from './cors';
import { createApp } from './index';
import { createTestDb } from './test/d1';

const GAME = 'https://game.crazygames.com';
const ALLOWED = 'https://www.typefight.io, https://*.crazygames.com';

describe('originAllowed', () => {
  it('allows exact origins and subdomains matched by a wildcard entry', () => {
    expect(originAllowed('https://www.typefight.io', ALLOWED)).toBe(true);
    expect(originAllowed(GAME, ALLOWED)).toBe(true);
    expect(originAllowed('https://a.b.crazygames.com', ALLOWED)).toBe(true);
  });

  it('rejects look-alikes, other schemes, ports and the bare domain for a wildcard', () => {
    expect(originAllowed('https://evilcrazygames.com', ALLOWED)).toBe(false);
    expect(originAllowed('https://crazygames.com.evil.io', ALLOWED)).toBe(false);
    expect(originAllowed('https://crazygames.com', ALLOWED)).toBe(false);
    expect(originAllowed('http://game.crazygames.com', ALLOWED)).toBe(false);
    expect(originAllowed('https://game.crazygames.com:8443', ALLOWED)).toBe(false);
    expect(originAllowed('https://typefight.io', ALLOWED)).toBe(false);
  });

  it('allows nothing when the list is empty or unset, and never treats * as everything', () => {
    expect(originAllowed(GAME, undefined)).toBe(false);
    expect(originAllowed(GAME, '')).toBe(false);
    expect(originAllowed(GAME, ' , ')).toBe(false);
    expect(originAllowed(GAME, '*')).toBe(false);
  });

  it('rejects malformed origins', () => {
    expect(originAllowed('not a url', ALLOWED)).toBe(false);
    expect(originAllowed('https://game.crazygames.com/path', ALLOWED)).toBe(false);
    expect(originAllowed('null', ALLOWED)).toBe(false);
  });
});

describe('CORS middleware', () => {
  const app = createApp(() => 1_000_000);
  const request = (path: string, init: RequestInit, allowed: string | undefined = ALLOWED) =>
    app.request(path, init, {
      DB: createTestDb().d1,
      ALLOWED_ORIGINS: allowed,
      METRICS_TOKEN: 's',
    });

  it('answers the preflight of an allowed game origin', async () => {
    const response = await request('/api/duel/start', {
      method: 'OPTIONS',
      headers: {
        Origin: GAME,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(GAME);
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
    expect(response.headers.get('Vary')).toContain('Origin');
  });

  it('adds the allow header to real responses for an allowed origin only', async () => {
    const ok = await request('/api/leaderboard?lang=en&period=daily', {
      headers: { Origin: GAME },
    });
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(GAME);
    const blocked = await request('/api/leaderboard?lang=en&period=daily', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(blocked.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(blocked.headers.get('Vary')).toContain('Origin');
  });

  it('refuses the preflight of an unknown origin', async () => {
    const response = await request('/api/duel/start', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
    });
    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('leaves same-origin requests (no Origin header) untouched', async () => {
    const response = await request('/api/leaderboard?lang=en&period=daily', {});
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('allows nothing cross-origin when no origins are configured', async () => {
    const response = await app.request(
      '/api/leaderboard?lang=en&period=daily',
      { headers: { Origin: GAME } },
      { DB: createTestDb().d1 },
    );
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('never opens the admin endpoints to other sites', async () => {
    const preflight = await request('/api/admin/metrics', {
      method: 'OPTIONS',
      headers: { Origin: GAME, 'Access-Control-Request-Method': 'GET' },
    });
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const get = await request('/api/admin/metrics', {
      headers: { Origin: GAME, Authorization: 'Bearer s' },
    });
    expect(get.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
