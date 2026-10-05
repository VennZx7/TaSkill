import type { CSSProperties } from 'react';
import type { Item } from '../types/item';
import { formatToWIB } from '../utils/date';
import styles from './SmartDashboard.module.css';

// Accent tokens come from global.css so they resolve per theme.
const OVERDUE_ACCENT = 'var(--danger-rail)';
const TODAY_ACCENT = 'var(--warning-rail)';
const EXAM_ACCENT = 'var(--rail-default)';

interface PanelProps {
  label: string;
  items: Item[];
  accent: string;
  alert?: boolean;
}

function Panel({ label, items, accent, alert = false }: PanelProps) {
  return (
    <section
      className={styles.panel}
      style={{ '--accent': accent } as CSSProperties}
      aria-label={label}
    >
      <div className={styles.header}>
        <h2 className={styles.label}>{label}</h2>
        <span className={`${styles.count} ${alert ? styles.countAlert : ''}`}>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>Tidak ada.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.row}>
              <span className={styles.rail} aria-hidden="true" />
              <span className={styles.rowBody}>
                <span className={styles.rowTitle} title={item.title}>
                  {item.title}
                </span>
                <span className={styles.rowMeta}>
                  {item.course} · {formatToWIB(item.deadline)} WIB
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface SmartDashboardProps {
  dueToday: Item[];
  overdue: Item[];
  upcomingExams: Item[];
}

export function SmartDashboard({ dueToday, overdue, upcomingExams }: SmartDashboardProps) {
  return (
    <div className={styles.grid}>
      <Panel label="Tugas Hari Ini" items={dueToday} accent={TODAY_ACCENT} />
      <Panel label="Terlewat" items={overdue} accent={OVERDUE_ACCENT} alert />
      <Panel label="Ujian Terdekat" items={upcomingExams} accent={EXAM_ACCENT} />
    </div>
  );
}
