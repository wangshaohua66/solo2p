import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      className,
      ...rest
    },
    ref,
  ) => {
    const buttonClasses = [
      styles.button,
      styles[variant],
      styles[size],
      fullWidth ? styles.fullWidth : '',
      className || '',
    ]
      .filter(Boolean)
      .join(' ');

    const isDisabled = disabled || loading;

    return (
      <button ref={ref} className={buttonClasses} disabled={isDisabled} {...rest}>
        {loading && <span className={styles.spinner} aria-hidden="true" />}
        {!loading && leftIcon && <span className={styles.icon}>{leftIcon}</span>}
        {children && <span>{children}</span>}
        {!loading && rightIcon && <span className={styles.icon}>{rightIcon}</span>}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
