import type { ReactNode } from 'react';
import styles from './StatTile.module.css';

interface StatTileProps {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  tone?: 'neutral' | 'accent';
}

export function StatTile({ label, value, hint, icon, tone = 'neutral' }: StatTileProps) {
  return (
    <div className={`${styles.tile} ${tone === 'accent' ? styles.accent : ''}`.trim()}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}