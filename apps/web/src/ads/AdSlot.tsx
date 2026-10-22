import { useEffect, useRef, useState } from 'react';
import { IS_CRAZYGAMES_BUILD } from '../portal';
import type { Screen } from '../store/useAppStore';
import { adSenseConfig, loadAdSenseScript, watchAdFill } from './adProvider';
import { pickHouseAd } from './houseAds';
import { adPlaceholdersEnabled, screenHasAd } from './adSlots';
import styles from './AdSlot.module.css';

const enabled = adPlaceholdersEnabled(import.meta.env.VITE_AD_PLACEHOLDERS, IS_CRAZYGAMES_BUILD);
const provider = adSenseConfig(
  import.meta.env.VITE_ADSENSE_CLIENT,
  import.meta.env.VITE_ADSENSE_SLOT,
  IS_CRAZYGAMES_BUILD,
);
// One house ad per page load, so the slot does not change from screen to screen.
const houseAd = pickHouseAd();

type Source = 'checking' | 'provider' | 'house';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const Slot = () => {
  // With no provider configured the slot shows our own ad straight away.
  const [source, setSource] = useState<Source>(provider ? 'checking' : 'house');
  const unit = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!provider || source !== 'checking') return;
    let live = true;
    void loadAdSenseScript(provider.client).then((loaded) => {
      if (live) setSource(loaded ? 'provider' : 'house');
    });
    return () => {
      live = false;
    };
  }, [source]);

  useEffect(() => {
    if (source !== 'provider' || !unit.current) return;
    let live = true;
    try {
      (window.adsbygoogle ??= []).push({});
    } catch {
      setSource('house');
      return;
    }
    void watchAdFill(unit.current).then((filled) => {
      if (live && !filled) setSource('house');
    });
    return () => {
      live = false;
    };
  }, [source]);

  return (
    <aside id="ad-slot" className={styles.slot} aria-label="Advertisement" data-ad-source={source}>
      {source === 'provider' && provider && (
        <ins
          ref={unit}
          className={`adsbygoogle ${styles.unit}`}
          style={{ display: 'block' }}
          data-ad-client={provider.client}
          data-ad-slot={provider.slot}
        />
      )}
      {source === 'house' && houseAd && (
        <a
          className={`${styles.unit} ${styles.house}`}
          data-ad-placeholder="banner"
          href={houseAd.href}
          target="_blank"
          rel="noopener sponsored"
        >
          <img className={styles.icon} src={houseAd.icon} alt="" width="32" height="32" />
          <span className={styles.copy}>
            <span className={styles.name}>{houseAd.name}</span>
            <span className={styles.tagline}>{houseAd.tagline}</span>
          </span>
          <span className={styles.label}>Ad</span>
        </a>
      )}
      {(source === 'checking' || (source === 'house' && !houseAd)) && (
        <div className={styles.unit} data-ad-placeholder="banner" />
      )}
    </aside>
  );
};

/**
 * The banner under the page content. Its height is fixed whatever is inside, so nothing can shift
 * when an ad loads or falls back. An ad provider's ad comes first; if it is blocked, fails to load
 * or has nothing to show, one of our own apps takes the slot.
 */
export const AdSlot = ({ screen }: { screen: Screen }) =>
  enabled && screenHasAd(screen) ? <Slot /> : null;
