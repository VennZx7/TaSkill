import type { Item } from '../types/item';
import { CollectionStates, SCHEDULER_EMPTY } from './CollectionStates';
import { ItemCard } from './ItemCard';
import styles from './ListView.module.css';
import shared from './CollectionStates.module.css';

interface ListViewProps {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  items: Item[];
  isFiltered: boolean;
  onRetry: () => void;
  onCreate: () => void;
  onOpen: (item: Item) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}

/** Nearest deadline first — the order the sorted context already produced. */
export function ListView({
  status,
  error,
  items,
  isFiltered,
  onRetry,
  onCreate,
  onOpen,
  onEdit,
  onDelete,
}: ListViewProps) {
  return (
    <CollectionStates
      status={status}
      error={error}
      isEmpty={items.length === 0}
      isFiltered={isFiltered}
      empty={SCHEDULER_EMPTY}
      loading={
        <div className={styles.grid} aria-busy="true" aria-label="Memuat item">
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
          <ItemCard key={item.id} item={item} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </CollectionStates>
  );
}
