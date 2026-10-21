import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { runSmokeTest } from './smokeTest.mjs';

async function fixture(t, failure) {
  const requests = [];
  let nickname;
  const server = createServer(async (req, res) => {
    try {
      requests.push(`${req.method} ${req.url}`);
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : undefined;
      const send = (status, value, type = 'application/json') => {
        res.writeHead(status, { 'Content-Type': type });
        res.end(type === 'application/json' ? JSON.stringify(value) : value);
      };
      if (req.url === '/')
        return send(
          200,
          '<div id="root"></div><script type="module" src="/assets/app.js"></script>',
          'text/html',
        );
      if (req.url === '/assets/app.js')
        return send(
          200,
          'export {};',
          failure === 'asset' ? 'text/html' : 'application/javascript',
        );
      if (req.url === '/health') return send(failure === 'health' ? 503 : 200, { status: 'ok' });
      if (req.url === '/health/db') return send(200, { status: 'ok', db: true });
      if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      if (req.method === 'OPTIONS') {
        assert.equal(req.headers['access-control-request-method'], 'POST');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        return send(204, null);
      }
      if (req.url === '/api/player') {
        assert.match(body.nickname, /^smoke-[a-f0-9]{10}$/);
        assert.equal(req.headers.authorization, undefined);
        nickname = body.nickname;
        return send(201, {
          created: true,
          playerId: 'player',
          nickname,
          deviceToken: 'device-secret',
        });
      }
      if (/^\/api\/(session|duel)\//.test(req.url)) {
        assert.equal(req.headers.authorization, 'Bearer device-secret');
        const mode = req.url.split('/')[2];
        if (req.url.endsWith('/start')) {
          assert.equal(body.lang, 'en');
          if (mode === 'session') assert.equal(body.mode, 'simulator');
          return send(201, {
            sessionId: mode,
            sessionToken: 'session-secret',
            text: 'the calm river flows',
            opponent: { sessionId: 'ghost', isBot: true, record: { events: [] } },
          });
        }
        assert.equal(body.sessionId, mode);
        assert.equal(body.sessionToken, 'session-secret');
        assert.equal(body.events.map((event) => event.key).join(''), 'the calm');
        assert.ok(
          body.events.every(
            (event, i) => event.t > (body.events[i - 1]?.t ?? 0) && event.t <= body.durationMs,
          ),
        );
        return send(200, {
          sessionId: mode,
          verified: true,
          result: {
            wpm: Math.round((8 / 5 / (body.durationMs / 60000)) * 100) / 100,
            accuracy: 100,
            correctChars: 8,
            durationMs: body.durationMs,
          },
          duel: { winner: 'opponent', ratingApplied: true, rating: { after: 980 } },
        });
      }
      if (req.url.startsWith('/api/leaderboard')) return send(200, { entries: [] });
      if (req.url === '/api/profile/player')
        return send(200, { playerId: 'player', nickname, sessions: 2, duels: { played: 1 } });
      if (req.url === '/api/events') {
        assert.equal(req.headers.authorization, undefined);
        assert.match(body.clientId, /^[a-f0-9]{32}$/);
        assert.deepEqual(body.events, [{ name: 'game_open', props: {} }]);
        return send(202, { accepted: 1 });
      }
      if (req.url === '/api/admin/metrics?days=30') {
        assert.equal(req.headers.authorization, 'Bearer admin-secret');
        const retention = { eligible: 0, retained: 0, rate: null };
        return send(200, {
          window: { days: 30 },
          daily: [],
          activeClients: 1,
          retention: { d1: retention, d7: retention },
          duels: { perPlayer: null, rematchRate: null },
        });
      }
      send(404, { error: 'unexpected_request' });
    } catch (error) {
      res.writeHead(500);
      res.end(error.message);
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  );
  return { url: `http://127.0.0.1:${server.address().port}`, requests };
}

test('all deployed steps pass against local servers, including CORS and admin', async (t) => {
  const api = await fixture(t);
  const web = await fixture(t);
  const lines = [];
  const result = await runSmokeTest({
    api: api.url,
    web: web.url,
    adminToken: 'admin-secret',
    log: (line) => lines.push(line),
  });
  assert.equal(result.exitCode, 0, lines.join('\n'));
  assert.equal(result.steps.length, 15);
  assert.ok(result.steps.every((step) => step.passed));
  assert.match(lines.at(-1), /15 passed, 0 failed/);
  assert.ok(lines.slice(0, -1).every((line) => /^PASS .+ \d+ms$/.test(line)));
});

test('CLI exits zero without admin token and never calls metrics', async (t) => {
  const { url, requests } = await fixture(t);
  const child = spawn(process.execPath, ['scripts/smokeTest.mjs', '--api', url, '--web', url]);
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  assert.equal((await once(child, 'close'))[0], 0, output);
  assert.match(output, /12 passed, 0 failed/);
  assert.ok(!requests.some((path) => path.includes('/admin/')));
});

test('CLI reports the failed health step, exits nonzero, and stops before writes', async (t) => {
  const { url, requests } = await fixture(t, 'health');
  const child = spawn(process.execPath, ['scripts/smokeTest.mjs', '--api', url, '--web', url]);
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  assert.equal((await once(child, 'close'))[0], 1);
  assert.match(output, /FAIL API health \d+ms: Expected HTTP 200, got 503/);
  assert.match(output, /2 passed, 1 failed/);
  assert.ok(!requests.some((path) => path.startsWith('POST')));
});

test('rejects an HTML fallback served as a JS asset', async (t) => {
  const { url } = await fixture(t, 'asset');
  const result = await runSmokeTest({ api: url, web: url, log: () => {} });
  assert.equal(result.exitCode, 1);
  assert.equal(result.steps.at(-1).name, 'web JS asset');
});
