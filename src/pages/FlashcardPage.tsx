import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FlashcardDeckList } from '../components/FlashcardDeckList';
import { FlashcardGeneratorModal } from '../components/FlashcardGeneratorModal';
import { StudyModeView } from '../components/StudyModeView';
import { Button } from '../components/ui/Button';
import { CardsIcon, SparkleIcon } from '../components/ui/icons';
import { useToast } from '../components/ui/Toast';
import { useFlashcards } from '../context/FlashcardContext';
import { useFlashcardGenerator } from '../hooks/useFlashcardGenerator';
import { TaskServiceError } from '../services/errors';
import type { FlashcardDeck } from '../types/flashcard';
import styles from './FlashcardPage.module.css';

function messageOf(error: unknown): string {
  if (error instanceof TaskServiceError) return error.message;
  return 'Terjadi kesalahan tak terduga. Coba lagi.';
}

export function FlashcardPage() {
  const { status, error, decks, reload, markStudied, remove } = useFlashcards();
  const generator = useFlashcardGenerator();
  const toast = useToast();

  const [studying, setStudying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FlashcardDeck | null>(null);
  const [saving, setSaving] = useState(false);

  // The deck is resolved by id on every render, so deleting it or reloading the
  // list can never leave Study Mode showing a record that is no longer stored.
  const active = decks.find((deck) => deck.id === studying) ?? null;

  const openStudyMode = async (deck: FlashcardDeck) => {
    setStudying(deck.id);
    toast(`Mulai belajar: "${deck.title}".`);
    try {
      await markStudied(deck.id);
    } catch (caught) {
      toast({ message: messageOf(caught), tone: 'error' });
    }
  };

  /** A fresh deck is dropped straight into Study Mode: the student just asked for
   *  cards, so the fastest useful next step is to start using them. */
  const handleGenerate = async () => {
    const deck = await generator.submit();
    if (deck) await openStudyMode(deck);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await remove(deleting.id);
      toast(`Deck "${deleting.title}" dihapus.`);
      setDeleting(null);
    } catch (caught) {
      toast({ message: messageOf(caught), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const body: ReactNode = active ? (
    <StudyModeView deck={active} onExit={() => setStudying(null)} />
  ) : (
    <>
      <div className={styles.toolbar}>
        <div>
          <h2 className={styles.heading}>Flashcards</h2>
          <p className={styles.subheading}>
            Deck tanya-jawab dari materi Study Vault. Klik deck untuk mulai belajar.
          </p>
        </div>
        <Button variant="primary" onClick={() => generator.open()}>
          <SparkleIcon size={16} />
          Generate Flashcards dengan AI
        </Button>
      </div>

      {decks.length > 0 ? (
        <p className={styles.summary}>
          <CardsIcon size={14} />
          {decks.length} deck · {decks.reduce((total, deck) => total + deck.cards.length, 0)} kartu
          tersimpan
        </p>
      ) : null}

      <FlashcardDeckList
        status={status}
        error={error}
        decks={decks}
        onRetry={() => void reload()}
        onGenerate={() => generator.open()}
        onOpen={(deck) => void openStudyMode(deck)}
        onDelete={setDeleting}
      />
    </>
  );

  return (
    <>
      {body}

      <FlashcardGeneratorModal
        open={generator.isOpen}
        materials={generator.materials}
        materialId={generator.materialId}
        title={generator.title}
        count={generator.count}
        counts={generator.counts}
        apiKey={generator.apiKey}
        needsKey={generator.needsKey}
        isGenerating={generator.isGenerating}
        error={generator.error}
        onMaterialChange={generator.setMaterialId}
        onTitleChange={generator.setTitle}
        onCountChange={generator.setCount}
        onApiKeyChange={generator.setApiKey}
        onClose={generator.close}
        onSubmit={() => void handleGenerate()}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus deck flashcard?"
        message={deleting ? `"${deleting.title}" beserta seluruh kartunya akan dihapus.` : ''}
        confirmLabel="Hapus"
        pending={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
