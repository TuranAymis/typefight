import { IS_CRAZYGAMES_BUILD } from '../portal';
import type { Screen } from '../store/useAppStore';
import { adPlaceholdersEnabled, screenHasAd } from './adSlots';
import styles from './AdSlot.module.css';

const enabled = adPlaceholdersEnabled(import.meta.env.VITE_AD_PLACEHOLDERS, IS_CRAZYGAMES_BUILD);

/**
 * A banner placeholder under the page content. Its height is fixed, so a real ad filling it later
 * cannot shift anything. It takes no focus and no clicks, and is not in the tab order.
 */
export const AdSlot = ({ screen }: { screen: Screen }) =>
  enabled && screenHasAd(screen) ? (
    <aside id="ad-slot" className={styles.slot} aria-label="Advertisement">
      <div className={styles.unit} data-ad-placeholder="banner">
        <span className={styles.label}>Advertisement</span>
      </div>
    </aside>
  ) : null;
