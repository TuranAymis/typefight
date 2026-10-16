/**
 * Where the API lives. Empty (same origin, proxied in dev) for the normal site. A portal build runs
 * on the portal's own domain, so it is built with VITE_API_BASE pointing at the deployed API.
 */
const base = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

export const apiUrl = (path: string): string => `${base}${path}`;
