/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Web Analytics site token. Leave unset to not load the beacon. */
  readonly VITE_CF_BEACON_TOKEN?: string;
  /** Base URL of the deployed API for portal builds (no trailing slash). Unset = same origin. */
  readonly VITE_API_BASE?: string;
  /** https address of the feedback form or issue tracker. Unset = no feedback link. */
  readonly VITE_FEEDBACK_URL?: string;
  /** "true" shows banner placeholders on the calm screens. Never shown in the portal build. */
  readonly VITE_AD_PLACEHOLDERS?: string;
  /** AdSense publisher id (ca-pub-...). With VITE_ADSENSE_SLOT the slot tries AdSense first. */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** AdSense ad unit id for the banner slot. */
  readonly VITE_ADSENSE_SLOT?: string;
}
