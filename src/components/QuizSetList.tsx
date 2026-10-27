import type { QuizSet } from '../types/quiz';
import { formatToWIB } from '../utils/date';
import { CollectionStates, QUIZ_EMPTY } from './CollectionStates';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ListIcon, PlayIcon, TrashIcon } from './ui/icons';
import shared from './CollectionStates.module.css';
import styles from './QuizSetList.module.css';

interface QuizSetListProps {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  sets: QuizSet[];
  onRetry: () => void;
  onGenerate: () => void;
  onOpen: (set: QuizSet) => void;
  onDelete: (set: QuizSet) => void;
}

function lastStudiedLabel(set: QuizSet): string {
  return set.lastStudied
    ? `Terakhir dikerjakan ${formatToWIB(set.lastStudied)} WIB`
    : 'Belum pernah dikerjakan';
}

export function QuizSetList({
  status,
  error,
  sets,
  onRetry,
  onGenerate,
  onOpen,
  onDelete,
}: QuizSetListProps) {
  return (
    <CollectionStates
      status={status}
      error={error}
      isEmpty={sets.length === 0}
      isFiltered={false}
      empty={QUIZ_EMPTY}
      loading={
        <div className={styles.grid} aria-busy="true" aria-label="Memuat kuis">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={shared.skeleton} />
          ))}
        </div>
      }
      onRetry={onRetry}
      onCreate={onGenerate}
    >
      <div className={styles.grid}>
        {sets.map((set) => (
          <article key={set.id} className={styles.card}>
            <header className={styles.header}>
              <span className={styles.icon} aria-hidden="true">
                <ListIcon size={18} />
              </span>
              {/* One real button, stretched over the card: the whole
                  set opens the quiz, while the footer controls stay
                  above the overlay. */}
              <button type="button" className={styles.titleButton} onClick={() => onOpen(set)}>
                <h3 className={styles.title}>{set.title}</h3>
              </button>
            </header>

            <div className={styles.badges}>
              <Badge tone="accent">{set.questions.length} soal</Badge>
              {set.lastStudied ? <Badge tone="success">Sudah dikerjakan</Badge> : null}
            </div>

            <p className={styles.preview}>
              {set.questions[0]?.prompt ?? 'Kuis ini belum punya soal.'}
            </p>

            <footer className={styles.footer}>
              <span className={styles.meta}>{lastStudiedLabel(set)}</span>
              <div className={styles.actions}>
                <Button variant="ghost" size="sm" onClick={() => onOpen(set)}>
                  <PlayIcon size={14} />
                  Kerjakan
                </Button>
                <Button variant="subtle" size="sm" onClick={() => onDelete(set)}>
                  <TrashIcon size={14} />
                  Hapus
                </Button>
              </div>
            </footer>
          </article>
        ))}
      </div>
    </CollectionStates>
  );
}
