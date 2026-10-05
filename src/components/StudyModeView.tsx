import { useEffect, useState } from 'react';
import type { FlashcardDeck } from '../types/flashcard';
import { formatToWIB } from '../utils/date';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ChevronLeftIcon, ChevronRightIcon, FlipIcon } from './ui/icons';
import styles from './StudyModeView.module.css';

interface StudyModeViewProps {
  deck: FlashcardDeck;
  onExit: () => void;
}

export function StudyModeView({ deck, onExit }: StudyModeViewProps) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const total = deck.cards.length;
  const card = deck.cards[Math.min(index, total - 1)];

  /** Moving always lands the question side up: a flipped card is not a
   *  half-answered card. */
  function goTo(next: number) {
    if (next < 0 || next >= total) return;
    setIndex(next);
    setIsFlipped(false);
  }

  // Arrow keys move between cards. Typing is not a concern here: Study Mode has
  // no text input, so the keys would otherwise do nothing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(index - 1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [index, total]);

  if (total === 0) {
    return (
      <div className={styles.empty}>
        <p>Deck ini belum punya kartu. Buat deck baru dari materi Study Vault.</p>
        <Button variant="primary" onClick={onExit}>
          Kembali ke daftar deck
        </Button>
      </div>
    );
  }

  return (
    <section className={styles.root} aria-label={`Study Mode — ${deck.title}`}>
      <header className={styles.header}>
        <div className={styles.headline}>
          <h2 className={styles.title}>{deck.title}</h2>
          <span className={styles.meta}>
            {deck.lastStudied
              ? `Terakhir dipelajari ${formatToWIB(deck.lastStudied)} WIB`
              : 'Sesi belajar baru'}
          </span>
        </div>
        <div className={styles.headerActions}>
          <Badge tone="accent">{total} kartu</Badge>
          <Button variant="ghost" size="sm" onClick={onExit}>
            Kembali ke daftar
          </Button>
        </div>
      </header>

      {/* Both faces share one grid cell, so the card keeps a single height while
          it flips instead of resizing between question and answer. */}
      <div className={styles.stage}>
        <button
          type="button"
          className={`${styles.card} ${isFlipped ? styles.flipped : ''}`.trim()}
          aria-pressed={isFlipped}
          onClick={() => setIsFlipped((current) => !current)}
        >
          <span className={`${styles.face} ${styles.front}`}>
            <span className={styles.side}>Pertanyaan</span>
            <span className={styles.text}>{card.question}</span>
          </span>
          <span className={`${styles.face} ${styles.back}`}>
            <span className={styles.side}>Jawaban</span>
            <span className={styles.text}>{card.answer}</span>
          </span>
        </button>
      </div>

      <div className={styles.controls}>
        <Button variant="secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>
          <ChevronLeftIcon size={16} />
          Sebelumnya
        </Button>

        <span className={styles.counter} aria-live="polite">
          Kartu {index + 1} dari {total}
        </span>

        <Button
          variant="secondary"
          onClick={() => goTo(index + 1)}
          disabled={index === total - 1}
        >
          Berikutnya
          <ChevronRightIcon size={16} />
        </Button>
      </div>

      <p className={styles.tip}>
        <FlipIcon size={14} />
        Klik kartu untuk membalik atau panah kiri/kanan untuk berpindah.
      </p>
    </section>
  );
}
