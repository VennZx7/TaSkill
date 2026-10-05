import { VAULT_TYPE_LABEL, type VaultItem, type VaultType } from '../types/vault';
import { formatToWIB } from '../utils/date';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { CheckIcon, DocIcon, LinkIcon, NoteIcon, PencilIcon, TagIcon, TrashIcon } from './ui/icons';
import styles from './VaultCard.module.css';

const TYPE_ICON = {
  link: LinkIcon,
  note: NoteIcon,
  document: DocIcon,
} as const satisfies Record<VaultType, typeof LinkIcon>;

/** Host of a saved URL, shown instead of the full address. Empty for a bad URL. */
function hostOf(urlOrContent: string): string {
  try {
    return new URL(urlOrContent).host;
  } catch {
    return '';
  }
}

interface VaultCardProps {
  item: VaultItem;
  onEdit: (item: VaultItem) => void;
  onDelete: (item: VaultItem) => void;
  onToggleRead: (item: VaultItem) => void;
}

export function VaultCard({ item, onEdit, onDelete, onToggleRead }: VaultCardProps) {
  const TypeIcon = TYPE_ICON[item.type];
  const host = item.type === 'link' ? hostOf(item.urlOrContent) : '';

  return (
    <article className={`${styles.card} ${item.isRead ? styles.read : ''}`.trim()}>
      <header className={styles.header}>
        <span className={styles.typeIcon} aria-hidden="true">
          <TypeIcon size={16} />
        </span>
        <div className={styles.headline}>
          <h3 className={styles.title}>{item.title}</h3>
          <span className={styles.course}>{item.course}</span>
        </div>
        {item.isRead ? <Badge tone="success">Sudah dibaca</Badge> : <Badge tone="accent">Baru</Badge>}
      </header>

      {item.type === 'link' ? (
        <a
          className={styles.link}
          href={item.urlOrContent}
          target="_blank"
          rel="noreferrer noopener"
        >
          {host || item.urlOrContent}
        </a>
      ) : (
        <p className={styles.preview}>{item.urlOrContent}</p>
      )}

      <div className={styles.tags}>
        <TagIcon size={12} />
        {item.tags.length === 0 ? (
          <span className={styles.noTags}>Tanpa tag</span>
        ) : (
          item.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))
        )}
      </div>

      <footer className={styles.footer}>
        <span className={styles.meta}>
          {VAULT_TYPE_LABEL[item.type]} · {formatToWIB(item.createdAt)} WIB
        </span>
        <div className={styles.actions}>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={item.isRead}
            onClick={() => onToggleRead(item)}
          >
            <CheckIcon size={14} />
            {item.isRead ? 'Tandai belum' : 'Tandai dibaca'}
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
      </footer>
    </article>
  );
}