import { TASK_STATUSES, type Item, type TaskPriority, type TaskStatus } from '../types/item';
import { ITEM_TYPE_LABEL } from '../types/item';
import { getUrgency } from '../utils/date';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { DeadlineBadge } from './DeadlineBadge';
import { EyeIcon, PencilIcon, TrashIcon } from './ui/icons';
import styles from './ItemCard.module.css';

const STATUS_TONE = {
  'To Do': 'neutral',
  'In Progress': 'accent',
  Done: 'success',
} as const satisfies Record<TaskStatus, 'neutral' | 'accent' | 'success'>;

const PRIORITY_TONE = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
} as const satisfies Record<TaskPriority, 'danger' | 'warning' | 'neutral'>;

const PRIORITY_LABEL = {
  High: 'Prioritas tinggi',
  Medium: 'Prioritas sedang',
  Low: 'Prioritas rendah',
} as const satisfies Record<TaskPriority, string>;

interface ItemCardProps {
  item: Item;
  onOpen: (item: Item) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  /**
   * Present in kanban view, where picking a status is how an item moves
   * between columns. In list view the status badge reads better than a picker.
   */
  onStatusChange?: (item: Item, status: TaskStatus) => void;
}

export function ItemCard({ item, onOpen, onEdit, onDelete, onStatusChange }: ItemCardProps) {
  const urgency = getUrgency(item.deadline);
  const isDone = item.status === 'Done';

  const variant = isDone
    ? styles.done
    : urgency === 'overdue' || urgency === 'critical'
      ? styles.overdue
      : urgency === 'approaching'
        ? styles.approaching
        : urgency === 'invalid'
          ? styles.invalid
          : '';

  return (
    <article className={`${styles.card} ${variant}`.trim()}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{item.title}</h3>
        </div>
        <span className={styles.course}>{item.course}</span>
      </div>

      {item.description ? <p className={styles.description}>{item.description}</p> : null}

      <div className={styles.footer}>
        <div className={styles.meta}>
          <DeadlineBadge deadline={item.deadline} status={item.status} />
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.meta}>
          <Badge tone="neutral">{ITEM_TYPE_LABEL[item.type]}</Badge>
          {onStatusChange ? (
            <select
              className={styles.statusSelect}
              value={item.status}
              aria-label={`Status untuk ${item.title}`}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onStatusChange(item, event.target.value as TaskStatus)}
            >
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          ) : (
            <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
          )}
          <Badge tone={PRIORITY_TONE[item.priority]}>{PRIORITY_LABEL[item.priority]}</Badge>
        </div>
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={() => onOpen(item)}>
            <EyeIcon size={14} />
            Detail
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
            <PencilIcon size={14} />
            Ubah
          </Button>
          <Button variant="subtle" size="sm" onClick={() => onDelete(item)}>
            <TrashIcon size={14} />
            Hapus
          </Button>
        </div>
      </div>
    </article>
  );
}
