import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const baseUrl = (value) => {
  const url = new URL(value);
  check(['http:', 'https:'].includes(url.protocol), 'Expected an HTTP(S) base URL');
  check(!url.username && !url.password && !url.search && !url.hash, 'Invalid base URL');
  return url.href.replace(/\/$/, '');
};

/** Sequential, fail-fast deployed checks. Returns an exit code without exiting the host process. */
export async function runSmokeTest({ api, web, adminToken, log = console.log }) {
  const steps = [];
  const started = performance.now();
  let current = 'configuration';
  let stepStarted = started;
  const step = async (name, action) => {
    current = name;
    stepStarted = performance.now();
    const value = await action();
    const ms = Math.round(performance.now() - stepStarted);
    steps.push({ name, passed: true, ms });
    log(`PASS ${name} ${ms}ms`);
    return value;
  };
  try {
    api = baseUrl(api);
    web = web ? baseUrl(web) : undefined;
    // Without --web (the site cannot be reached from this machine) the web and CORS steps are skipped.
    const origin = new URL(web ?? api).origin;
    const request = async (url, { status = 200, ...options } = {}) => {
      const response = await fetch(url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      check(response.status === status, `Expected HTTP ${status}, got ${response.status}`);
      return response;
    };
    const json = async (path, options) => (await request(`${api}${path}`, options)).json();
    const post = (path, body, token, status = 200) =>
      json(path, {
        method: 'POST',
        status,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

    const asset =
      web &&
      (await step('web HTML', async () => {
        const response = await request(`${web}/`);
        check(response.headers.get('content-type')?.includes('text/html'), 'Expected HTML');
        const html = await response.text();
        check(/<div\b[^>]*\bid\s*=\s*["']root["']/i.test(html), 'App root missing');
        const source = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)]
          .map((match) => new URL(match[1], `${web}/`))
          .find((url) => /\.m?js$/.test(url.pathname));
        check(source, 'Referenced JS asset missing');
        return source.href;
      }));
    if (web)
      await step('web JS asset', async () => {
        const response = await request(asset);
        check(
          /javascript|ecmascript/i.test(response.headers.get('content-type') ?? ''),
          'Expected JavaScript',
        );
        check((await response.text()).trim().length > 0, 'Empty JS asset');
      });
    await step('API health', async () =>
      check((await json('/health')).status === 'ok', 'Health not ok'),
    );
    await step('D1 health', async () => {
      const body = await json('/health/db');
      check(body.status === 'ok' && body.db === true, 'Database not ok');
    });
    if (origin !== new URL(api).origin) {
      await step('CORS preflight', async () => {
        const response = await request(`${api}/api/player`, {
          method: 'OPTIONS',
          status: 204,
          headers: {
            Origin: origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'authorization,content-type',
          },
        });
        check(
          response.headers.get('access-control-allow-origin') === origin,
          'Wrong allowed origin',
        );
        const tokens = (name) =>
          (response.headers.get(name) ?? '')
            .toLowerCase()
            .split(',')
            .map((s) => s.trim());
        check(tokens('access-control-allow-methods').includes('post'), 'POST not allowed');
        check(
          ['authorization', 'content-type'].every((name) =>
            tokens('access-control-allow-headers').includes(name),
          ),
          'Required headers not allowed',
        );
      });
      await step('CORS simple request', async () => {
        const response = await request(`${api}/api/leaderboard?limit=1`, {
          headers: { Origin: origin },
        });
        check(
          response.headers.get('access-control-allow-origin') === origin,
          'Wrong allowed origin',
        );
        await response.text();
      });
    }
    const nickname = `smoke-${randomBytes(5).toString('hex')}`;
    const player = await step('create disposable player', async () => {
      const body = await post('/api/player', { nickname }, undefined, 201);
      check(
        body.created === true &&
          typeof body.playerId === 'string' &&
          body.playerId.length > 0 &&
          typeof body.deviceToken === 'string' &&
          body.deviceToken.length > 0 &&
          body.nickname === nickname,
        'Invalid player response',
      );
      return body;
    });
    for (const mode of ['session', 'duel']) {
      const session = await step(`${mode} start`, async () => {
        const body = await post(
          `/api/${mode}/start`,
          { lang: 'en', ...(mode === 'session' ? { mode: 'simulator' } : {}) },
          player.deviceToken,
          201,
        );
        check(
          typeof body.sessionId === 'string' &&
            body.sessionId.length > 0 &&
            typeof body.sessionToken === 'string' &&
            body.sessionToken.length > 0 &&
            typeof body.text === 'string' &&
            /^[a-z ]+$/.test(body.text),
          'Invalid session response',
        );
        if (mode === 'duel')
          check(
            typeof body.opponent?.isBot === 'boolean' &&
              typeof body.opponent?.sessionId === 'string' &&
              Array.isArray(body.opponent?.record?.events),
            'Ghost/bot record missing',
          );
        return body;
      });
      await step(`${mode} submit and score`, async () => {
        // The API permits partial runs. Use a short prefix and actually wait its duration.
        let t = 0;
        const events = [...session.text.slice(0, 8)].map((key, index) => ({
          key,
          t: (t += [240, 310, 270, 360][index % 4]),
        }));
        const durationMs = t + 300;
        await delay(durationMs);
        const body = await post(
          `/api/${mode}/submit`,
          { sessionId: session.sessionId, sessionToken: session.sessionToken, events, durationMs },
          player.deviceToken,
        );
        const expectedWpm = Math.round((events.length / 5 / (durationMs / 60000)) * 100) / 100;
        check(
          body.sessionId === session.sessionId &&
            body.verified === true &&
            body.result?.wpm === expectedWpm &&
            body.result?.accuracy === 100 &&
            body.result?.correctChars === events.length &&
            body.result?.durationMs === durationMs,
          'Incorrect recomputed score',
        );
        if (mode === 'duel')
          check(
            ['player', 'opponent', 'draw'].includes(body.duel?.winner) &&
              typeof body.duel?.ratingApplied === 'boolean' &&
              Number.isFinite(body.duel?.rating?.after),
            'Duel outcome missing',
          );
      });
    }
    await step('leaderboard list', async () =>
      check(
        Array.isArray((await json('/api/leaderboard?lang=en&limit=5')).entries),
        'Leaderboard list missing',
      ),
    );
    await step('player profile', async () => {
      const body = await json(`/api/profile/${encodeURIComponent(player.playerId)}`);
      check(
        body.playerId === player.playerId &&
          body.nickname === nickname &&
          body.sessions === 2 &&
          body.duels?.played === 1,
        'Profile or saved runs missing',
      );
    });
    await step('anonymous analytics event', async () => {
      const body = await post(
        '/api/events',
        { clientId: randomBytes(16).toString('hex'), events: [{ name: 'game_open', props: {} }] },
        undefined,
        202,
      );
      check(body.accepted === 1, 'Event not accepted');
    });
    if (adminToken)
      await step('admin metrics', async () => {
        const body = await json('/api/admin/metrics?days=30', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        check(
          body.window?.days === 30 &&
            Array.isArray(body.daily) &&
            Number.isFinite(body.activeClients),
          'Invalid metrics response',
        );
        for (const retention of [body.retention?.d1, body.retention?.d7])
          check(
            Number.isFinite(retention?.eligible) &&
              Number.isFinite(retention?.retained) &&
              (retention?.rate === null || Number.isFinite(retention?.rate)),
            'Retention missing',
          );
        check(
          body.duels &&
            ['perPlayer', 'rematchRate'].every(
              (key) => body.duels[key] === null || Number.isFinite(body.duels[key]),
            ),
          'Duel metrics missing',
        );
      });
  } catch (error) {
    const ms = Math.round(performance.now() - stepStarted);
    // Do not echo response bodies or credentials into deployment logs.
    const message = error instanceof Error ? error.message : 'Unknown failure';
    steps.push({ name: current, passed: false, ms, error: message });
    log(`FAIL ${current} ${ms}ms: ${message}`);
  }
  const failed = steps.filter((step) => !step.passed).length;
  log(
    `Summary: ${steps.length - failed} passed, ${failed} failed; ${Math.round(performance.now() - started)}ms${failed ? '; stopped at first failure' : ''}`,
  );
  return { exitCode: failed ? 1 : 0, steps };
}

export async function main(args = process.argv.slice(2)) {
  try {
    const options = {};
    const names = { '--api': 'api', '--web': 'web', '--admin-token': 'adminToken' };
    for (let index = 0; index < args.length; index += 2) {
      const name = names[args[index]];
      check(
        name && !options[name] && args[index + 1] && !args[index + 1].startsWith('--'),
        'Invalid arguments',
      );
      options[name] = args[index + 1];
    }
    check(options.api, 'Required: --api <apiBase> [--web <webBase>] [--admin-token <token>]');
    return (await runSmokeTest(options)).exitCode;
  } catch (error) {
    console.error(`FAIL arguments 0ms: ${error.message}\nSummary: 0 passed, 1 failed`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main();
