import { TASK_STATUSES, type Item, type TaskStatus } from '../types/item';
import { CollectionStates, SCHEDULER_EMPTY } from './CollectionStates';
import { ItemCard } from './ItemCard';
import shared from './CollectionStates.module.css';
import styles from './KanbanView.module.css';

interface KanbanViewProps {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  items: Item[];
  isFiltered: boolean;
  onRetry: () => void;
  onCreate: () => void;
  onOpen: (item: Item) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onStatusChange: (item: Item, status: TaskStatus) => void;
}

export function KanbanView({
  status,
  error,
  items,
  isFiltered,
  onRetry,
  onCreate,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
}: KanbanViewProps) {
  return (
    <CollectionStates
      status={status}
      error={error}
      isEmpty={items.length === 0}
      isFiltered={isFiltered}
      empty={SCHEDULER_EMPTY}
      loading={
        <div className={styles.board} aria-busy="true" aria-label="Memuat item">
          {TASK_STATUSES.map((column) => (
            <div key={column} className={styles.column}>
              <div className={shared.skeleton} />
              <div className={shared.skeleton} />
            </div>
          ))}
        </div>
      }
      onRetry={onRetry}
      onCreate={onCreate}
    >
      <div className={styles.board}>
        {TASK_STATUSES.map((column) => {
          const columnItems = items.filter((item) => item.status === column);
          return (
            <section key={column} className={styles.column} aria-label={column}>
              <header className={styles.columnHeader}>
                <span className={styles.columnTitle}>{column}</span>
                <span className={styles.columnCount}>{columnItems.length}</span>
              </header>

              {columnItems.length === 0 ? (
                <p className={styles.columnEmpty}>Kosong</p>
              ) : (
                <div className={styles.columnBody}>
                  {columnItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onOpen={onOpen}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onStatusChange={onStatusChange}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </CollectionStates>
  );
}
