import { ITEM_TYPE_LABEL, type Item } from '../types/item';
import { formatToWIB } from '../utils/date';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { DeadlineBadge } from './DeadlineBadge';
import { Modal } from './ui/Modal';
import styles from './ItemDetailModal.module.css';

const PRIORITY_TONE = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
} as const;

const STATUS_TONE = {
  'To Do': 'neutral',
  'In Progress': 'accent',
  Done: 'success',
} as const;

interface ItemDetailModalProps {
  item: Item | null;
  onClose: () => void;
  onEdit: (item: Item) => void;
}

export function ItemDetailModal({ item, onClose, onEdit }: ItemDetailModalProps) {
  return (
    <Modal
      open={item !== null}
      title="Detail item"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Tutup</Button>
          {item ? (
            <Button variant="primary" onClick={() => onEdit(item)}>
              Ubah item
            </Button>
          ) : null}
        </>
      }
    >
      {item ? (
        <div className={styles.detail}>
          <h3 className={styles.title}>{item.title}</h3>

          <div className={styles.badges}>
            <Badge tone="neutral">{ITEM_TYPE_LABEL[item.type]}</Badge>
            <Badge tone="accent">{item.course}</Badge>
            <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
            <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
          </div>

          <div className={styles.section}>
            <span className={styles.label}>{item.type === 'exam' ? 'Tanggal ujian' : 'Deadline'}</span>
            <div>
              <DeadlineBadge deadline={item.deadline} status={item.status} />
            </div>
          </div>

          <div className={styles.section}>
            <span className={styles.label}>Deskripsi</span>
            <p className={styles.description}>{item.description || '—'}</p>
          </div>

          <div className={styles.meta}>
            <span>Dibuat {formatToWIB(item.createdAt)} WIB</span>
            <span>Diperbarui {formatToWIB(item.updatedAt)} WIB</span>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
