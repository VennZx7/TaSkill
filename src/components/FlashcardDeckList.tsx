import type { FlashcardDeck } from '../types/flashcard';
import { formatToWIB } from '../utils/date';
import { CollectionStates, FLASHCARD_EMPTY } from './CollectionStates';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { CardsIcon, PlayIcon, TrashIcon } from './ui/icons';
import shared from './CollectionStates.module.css';
import styles from './FlashcardDeckList.module.css';

interface FlashcardDeckListProps {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  decks: FlashcardDeck[];
  onRetry: () => void;
  onGenerate: () => void;
  onOpen: (deck: FlashcardDeck) => void;
  onDelete: (deck: FlashcardDeck) => void;
}

function lastStudiedLabel(deck: FlashcardDeck): string {
  return deck.lastStudied
    ? `Terakhir dipelajari ${formatToWIB(deck.lastStudied)} WIB`
    : 'Belum pernah dipelajari';
}

export function FlashcardDeckList({
  status,
  error,
  decks,
  onRetry,
  onGenerate,
  onOpen,
  onDelete,
}: FlashcardDeckListProps) {
  return (
    <CollectionStates
      status={status}
      error={error}
      isEmpty={decks.length === 0}
      isFiltered={false}
      empty={FLASHCARD_EMPTY}
      loading={
        <div className={styles.grid} aria-busy="true" aria-label="Memuat deck flashcard">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={shared.skeleton} />
          ))}
        </div>
      }
      onRetry={onRetry}
      onCreate={onGenerate}
    >
      <div className={styles.grid}>
        {decks.map((deck) => (
          <article key={deck.id} className={styles.card}>
            <header className={styles.header}>
              <span className={styles.icon} aria-hidden="true">
                <CardsIcon size={18} />
              </span>
              {/* One real button, stretched over the card: the whole deck opens
                  Study Mode, while the footer controls stay above the overlay. */}
              <button type="button" className={styles.titleButton} onClick={() => onOpen(deck)}>
                <h3 className={styles.title}>{deck.title}</h3>
              </button>
            </header>

            <div className={styles.badges}>
              <Badge tone="accent">{deck.cards.length} kartu</Badge>
              {deck.lastStudied ? <Badge tone="success">Sudah dipelajari</Badge> : null}
            </div>

            <p className={styles.preview}>{deck.cards[0]?.question ?? 'Deck ini belum punya kartu.'}</p>

            <footer className={styles.footer}>
              <span className={styles.meta}>{lastStudiedLabel(deck)}</span>
              <div className={styles.actions}>
                <Button variant="ghost" size="sm" onClick={() => onOpen(deck)}>
                  <PlayIcon size={14} />
                  Mulai
                </Button>
                <Button variant="subtle" size="sm" onClick={() => onDelete(deck)}>
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
