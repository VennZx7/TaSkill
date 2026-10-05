import type { CSSProperties, ReactNode } from 'react';
import type { Item } from '../types/item';
import { ITEM_TYPE_LABEL } from '../types/item';
import type { VaultItem } from '../types/vault';
import { VAULT_TYPE_LABEL } from '../types/vault';
import { DeadlineBadge } from './DeadlineBadge';
import { StatTile } from './StatTile';
import { Button } from './ui/Button';
import { BoardIcon, CalendarIcon, VaultIcon } from './ui/icons';
import styles from './DashboardView.module.css';

const URGENT_ACCENT = 'var(--danger-rail)';
const UNREAD_ACCENT = 'var(--rail-default)';

interface PanelProps {
  label: string;
  count: number;
  accent: string;
  alert?: boolean;
  action: ReactNode;
  children: ReactNode;
}

/** One titled section. Rows render inside; the panel owns the header and action. */
function Panel({ label, count, accent, alert = false, action, children }: PanelProps) {
  return (
    <section
      className={styles.panel}
      aria-label={label}
      style={{ '--accent': accent } as CSSProperties}
    >
      <header className={styles.header}>
        <div>
          <h2 className={styles.label}>{label}</h2>
          <span className={`${styles.count} ${alert ? styles.countAlert : ''}`}>{count}</span>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

interface DashboardViewProps {
  itemStats: { active: number; urgent: Item[] };
  vaultStats: { total: number; unread: VaultItem[] };
  onGoToScheduler: () => void;
  onGoToVault: () => void;
}

export function DashboardView({
  itemStats,
  vaultStats,
  onGoToScheduler,
  onGoToVault,
}: DashboardViewProps) {
  return (
    <div className={styles.stack}>
      <section className={styles.stats} aria-label="Statistik singkat">
        <StatTile
          label="Total Tugas Aktif"
          value={itemStats.active}
          hint="Belum ditandai selesai"
          tone="accent"
          icon={<CalendarIcon size={16} />}
        />
        <StatTile
          label="Total Materi Tersimpan"
          value={vaultStats.total}
          hint={`${vaultStats.unread.length} belum dibaca`}
          icon={<VaultIcon size={16} />}
        />
      </section>

      <div className={styles.grid}>
        <Panel
          label="Tenggat Waktu Dekat"
          count={itemStats.urgent.length}
          accent={URGENT_ACCENT}
          alert={itemStats.urgent.some((item) => item.status !== 'Done')}
          action={
            <Button variant="ghost" size="sm" onClick={onGoToScheduler}>
              <BoardIcon size={14} />
              Lihat Semua Tugas
            </Button>
          }
        >
          {itemStats.urgent.length === 0 ? (
            <p className={styles.empty}>Tidak ada tenggat dalam 48 jam ke depan. Bagus.</p>
          ) : (
            <ul className={styles.list}>
              {itemStats.urgent.map((item) => (
                <li key={item.id} className={styles.row}>
                  <span className={styles.rail} aria-hidden="true" />
                  <span className={styles.rowBody}>
                    <span className={styles.rowTitle} title={item.title}>
                      {item.title}
                    </span>
                    <span className={styles.rowMeta}>
                      {ITEM_TYPE_LABEL[item.type]} · {item.course}
                    </span>
                    <DeadlineBadge deadline={item.deadline} status={item.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          label="Materi Belum Dibaca"
          count={vaultStats.unread.length}
          accent={UNREAD_ACCENT}
          action={
            <Button variant="ghost" size="sm" onClick={onGoToVault}>
              <VaultIcon size={14} />
              Lihat Semua Materi
            </Button>
          }
        >
          {vaultStats.unread.length === 0 ? (
            <p className={styles.empty}>
              {vaultStats.total === 0 ? 'Vault masih kosong.' : 'Semua materi sudah dibaca.'}
            </p>
          ) : (
            <ul className={styles.list}>
              {vaultStats.unread.map((item) => (
                <li key={item.id} className={styles.row}>
                  <span className={styles.rail} aria-hidden="true" />
                  <span className={styles.rowBody}>
                    <span className={styles.rowTitle} title={item.title}>
                      {item.title}
                    </span>
                    <span className={styles.rowMeta}>
                      {VAULT_TYPE_LABEL[item.type]} · {item.course}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <section className={styles.quickActions} aria-label="Akses cepat">
        <h2 className={styles.quickLabel}>Akses Cepat</h2>
        <div className={styles.quickRow}>
          <Button onClick={onGoToScheduler}>
            <BoardIcon size={15} />
            Kelola Tugas dan Ujian
          </Button>
          <Button onClick={onGoToVault}>
            <VaultIcon size={15} />
            Buka Study Vault
          </Button>
        </div>
      </section>
    </div>
  );
}