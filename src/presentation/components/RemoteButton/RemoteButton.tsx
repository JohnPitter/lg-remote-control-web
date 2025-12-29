import { ReactNode } from 'react';
import styles from './RemoteButton.module.css';

interface RemoteButtonProps {
  icon?: ReactNode;
  label?: string;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}

export function RemoteButton({
  icon,
  label,
  onClick,
  size = 'md',
  variant = 'default',
  disabled = false,
}: RemoteButtonProps) {
  return (
    <button
      className={`${styles.remoteButton} ${styles[size]} ${styles[variant]}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {label && <span className={styles.label}>{label}</span>}
    </button>
  );
}
