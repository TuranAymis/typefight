import type { HTMLAttributes, ReactNode } from 'react';
import styles from './HudText.module.css';

export interface HudTextProps extends Omit<HTMLAttributes<HTMLDivElement>, 'aria-label'> {
  label: string;
  value: ReactNode;
  live?: 'off' | 'polite' | 'assertive';
  valueId?: string;
}

export const HudText = ({
  label,
  value,
  live = 'off',
  valueId,
  className,
  ...props
}: HudTextProps) => (
  <div
    className={[styles.hud, className].filter(Boolean).join(' ')}
    aria-live={live}
    aria-atomic="true"
    {...props}
  >
    <span className={styles.label}>{label}</span>
    <span className={styles.value} id={valueId}>
      {value}
    </span>
  </div>
);
