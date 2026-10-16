/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Web Analytics site token. Leave unset to not load the beacon. */
  readonly VITE_CF_BEACON_TOKEN?: string;
  /** Base URL of the deployed API for portal builds (no trailing slash). Unset = same origin. */
  readonly VITE_API_BASE?: string;
}
