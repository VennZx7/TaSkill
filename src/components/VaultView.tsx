import type { VaultItem } from '../types/vault';
import { CollectionStates, VAULT_EMPTY } from './CollectionStates';
import { VaultCard } from './VaultCard';
import shared from './CollectionStates.module.css';
import styles from './VaultView.module.css';

interface VaultViewProps {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  items: VaultItem[];
  isFiltered: boolean;
  onRetry: () => void;
  onCreate: () => void;
  onEdit: (item: VaultItem) => void;
  onDelete: (item: VaultItem) => void;
  onToggleRead: (item: VaultItem) => void;
}

export function VaultView({
  status,
  error,
  items,
  isFiltered,
  onRetry,
  onCreate,
  onEdit,
  onDelete,
  onToggleRead,
}: VaultViewProps) {
  return (
    <CollectionStates
      status={status}
      error={error}
      isEmpty={items.length === 0}
      isFiltered={isFiltered}
      empty={VAULT_EMPTY}
      loading={
        <div className={styles.grid} aria-busy="true" aria-label="Memuat materi">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className={shared.skeleton} />
          ))}
        </div>
      }
      onRetry={onRetry}
      onCreate={onCreate}
    >
      <div className={styles.grid}>
        {items.map((item) => (
          <VaultCard
            key={item.id}
            item={item}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleRead={onToggleRead}
          />
        ))}
      </div>
    </CollectionStates>
  );
}