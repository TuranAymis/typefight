import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui';
import { trackingAllowed } from './analytics';
import { loadCloudflareBeacon } from './analytics/cloudflare';
import { IS_CRAZYGAMES_BUILD, markPortalDocument, portal } from './portal';
import './index.css';

markPortalDocument();
portal.loadingStart();
// A portal page must not pull third-party scripts other than the portal SDK.
if (!IS_CRAZYGAMES_BUILD) {
  loadCloudflareBeacon(import.meta.env.VITE_CF_BEACON_TOKEN, trackingAllowed());
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found in document');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
