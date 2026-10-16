import type { MiddlewareHandler } from 'hono';
import type { AppContext } from './types';

/**
 * Whether `origin` (e.g. "https://games.example.com") is on the comma separated allow list. Entries
 * are exact origins, or "https://*.example.com" for any subdomain of example.com. There is no
 * bare "*": an empty list means no other site may call the API from a browser.
 */
export const originAllowed = (origin: string, allowList: string | undefined): boolean => {
  if (!allowList) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  return allowList
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .some((entry) => {
      if (entry === origin) return true;
      const wildcard = /^(https?):\/\/\*\.([a-z0-9.-]+)$/i.exec(entry);
      if (!wildcard) return false;
      const [, scheme, domain] = wildcard;
      // A wildcard covers subdomains on the default port only; anything else must be listed exactly.
      return (
        url.port === '' &&
        url.protocol === `${scheme?.toLowerCase()}:` &&
        url.hostname.toLowerCase().endsWith(`.${domain?.toLowerCase()}`)
      );
    });
};

const PREFLIGHT_MAX_AGE_S = 86_400;

/**
 * CORS for browser games hosted on another domain (a game portal). Same-origin traffic is untouched.
 * The admin endpoints are never opened to other sites.
 */
export const cors = (): MiddlewareHandler<AppContext> => async (context, next) => {
  const origin = context.req.header('Origin');
  if (!origin || context.req.path.startsWith('/api/admin')) return next();
  const allowed = originAllowed(origin, context.env.ALLOWED_ORIGINS);
  if (allowed) context.header('Access-Control-Allow-Origin', origin);
  context.header('Vary', 'Origin');
  if (context.req.method === 'OPTIONS') {
    if (!allowed) return context.body(null, 403);
    context.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    context.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    context.header('Access-Control-Max-Age', String(PREFLIGHT_MAX_AGE_S));
    return context.body(null, 204);
  }
  return next();
};
