import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = ({
  variant = 'primary',
  size = 'medium',
  className,
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    type={type}
    className={[styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')}
    {...props}
  />
);
