import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Panel.module.css';

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  children: ReactNode;
}

export const Panel = ({ title, children, className, ...props }: PanelProps) => (
  <section className={[styles.panel, className].filter(Boolean).join(' ')} {...props}>
    {title && <h2 className={styles.title}>{title}</h2>}
    {children}
  </section>
);
