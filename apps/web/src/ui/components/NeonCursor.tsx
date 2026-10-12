import type { HTMLAttributes } from 'react';
import styles from './NeonCursor.module.css';

export interface NeonCursorProps extends HTMLAttributes<HTMLSpanElement> {
  shape?: 'block' | 'underline';
  error?: boolean;
}

export const NeonCursor = ({
  shape = 'block',
  error = false,
  className,
  ...props
}: NeonCursorProps) => (
  <span
    className={[styles.cursor, styles[shape], error ? styles.error : '', className]
      .filter(Boolean)
      .join(' ')}
    {...props}
  />
);
