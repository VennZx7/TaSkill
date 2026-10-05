import type { Module } from '../components/AppShell';
import { CollectionStates, SCHEDULER_EMPTY } from '../components/CollectionStates';
import { DashboardView } from '../components/DashboardView';
import shared from '../components/CollectionStates.module.css';
import { useItems } from '../context/ItemContext';
import { useVault } from '../context/VaultContext';
import styles from './DashboardPage.module.css';

interface DashboardPageProps {
  onNavigate: (module: Module) => void;
}

/**
 * Landing page. Both providers are already mounted above the shell, so this
 * reads their derived stats — it never fetches on its own.
 */
export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { status: itemStatus, error: itemError, stats: itemStats, reload: reloadItems } = useItems();
  const { status: vaultStatus, error: vaultError, stats: vaultStats, reload: reloadVault } = useVault();

  // Either module being broken breaks the summary, so one retry reloads both.
  const broken = itemStatus === 'error' || vaultStatus === 'error';
  const loading = itemStatus === 'loading' || vaultStatus === 'loading';
  const error = itemError ?? vaultError;
  const retry = () => {
    void reloadItems();
    void reloadVault();
  };

  return (
    <>
      <div className={styles.hero}>
        <div>
          <h2 className={styles.heading}>Ringkasan Kuliah</h2>
          <p className={styles.subheading}>
            Apa yang perlu dicermati hari ini, lintas tugas, ujian, dan materi Study Vault.
          </p>
        </div>
      </div>

      <CollectionStates
        status={loading ? 'loading' : broken ? 'error' : 'ready'}
        error={error}
        isEmpty={false}
        isFiltered={false}
        empty={SCHEDULER_EMPTY}
        loading={
          <div className={styles.skeletonStack} aria-busy="true" aria-label="Memuat ringkasan">
            <div className={shared.skeleton} />
            <div className={shared.skeleton} />
          </div>
        }
        onRetry={retry}
        onCreate={() => onNavigate('scheduler')}
      >
        <DashboardView
          itemStats={itemStats}
          vaultStats={vaultStats}
          onGoToScheduler={() => onNavigate('scheduler')}
          onGoToVault={() => onNavigate('vault')}
        />
      </CollectionStates>
    </>
  );
}