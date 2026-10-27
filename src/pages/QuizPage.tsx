import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FlashcardDeckList } from '../components/FlashcardDeckList';
import { QuizGeneratorModal } from '../components/QuizGeneratorModal';
import { QuizSetList } from '../components/QuizSetList';
import { StudyModeView } from '../components/StudyModeView';
import { TakeQuizView } from '../components/TakeQuizView';
import { Button } from '../components/ui/Button';
import { CardsIcon, ListIcon, SparkleIcon } from '../components/ui/icons';
import { useToast } from '../components/ui/Toast';
import { useFlashcards } from '../context/FlashcardContext';
import { useQuizzes } from '../context/QuizContext';
import { useQuizGenerator } from '../hooks/useQuizGenerator';
import { TaskServiceError } from '../services/errors';
import type { FlashcardDeck } from '../types/flashcard';
import type { QuizSet } from '../types/quiz';
import { QUIZ_COUNTS } from '../types/quiz';
import styles from './QuizPage.module.css';

type QuizTab = 'quizzes' | 'flashcards';

const TABS: { value: QuizTab; label: string; Icon: typeof ListIcon }[] = [
  { value: 'quizzes', label: 'My Quizzes', Icon: ListIcon },
  { value: 'flashcards', label: 'My Flashcards', Icon: CardsIcon },
];

function messageOf(error: unknown): string {
  if (error instanceof TaskServiceError) return error.message;
  return 'Terjadi kesalahan tak terduga. Coba lagi.';
}

/**
 * The unified study hub. One generator builds a quiz, a
 * flashcard deck, or both from the same source; the tab
 * switcher keeps the two collections side by side without
 * a second fetch. The generator owns the single open
 * modal, so both tabs share one source of truth.
 */
export function QuizView() {
  const toast = useToast();
  const generator = useQuizGenerator();
  const {
    status: quizStatus,
    error: quizError,
    sets: quizzes,
    reload: reloadQuizzes,
    remove: removeQuiz,
  } = useQuizzes();
  const {
    status: deckStatus,
    error: deckError,
    decks,
    reload: reloadDecks,
    remove: removeDeck,
    markStudied: markDeckStudied,
  } = useFlashcards();

  const [tab, setTab] = useState<QuizTab>('quizzes');
  const [taking, setTaking] = useState<string | null>(null);
  const [studying, setStudying] = useState<string | null>(null);
  const [deletingQuiz, setDeletingQuiz] = useState<QuizSet | null>(null);
  const [deletingDeck, setDeletingDeck] = useState<FlashcardDeck | null>(null);
  const [saving, setSaving] = useState(false);

  // Resolved by id on every render, so deleting a set
  // or reloading a list can never leave a view showing
  // a record that is no longer stored.
  const activeQuiz = quizzes.find((set) => set.id === taking) ?? null;
  const activeDeck = decks.find((deck) => deck.id === studying) ?? null;

  const openQuiz = (set: QuizSet) => {
    setTaking(set.id);
  };

  const openStudyMode = async (deck: FlashcardDeck) => {
    setStudying(deck.id);
    toast(`Mulai belajar: "${deck.title}".`);
    try {
      await markDeckStudied(deck.id);
    } catch (caught) {
      toast({ message: messageOf(caught), tone: 'error' });
    }
  };

  /** A fresh deck is dropped straight into Study Mode: the student just
   *  asked for cards, so the fastest useful next step is to start using
   *  them. A fresh quiz stays in the list — its questions are the
   *  preview, and taking it is one click away. */
  const handleGenerate = async () => {
    const result = await generator.submit();
    if (result?.deck) await openStudyMode(result.deck);
  };

  const handleDeleteQuiz = async () => {
    if (!deletingQuiz) return;
    setSaving(true);
    try {
      await removeQuiz(deletingQuiz.id);
      toast(`Kuis "${deletingQuiz.title}" dihapus.`);
      setDeletingQuiz(null);
    } catch (caught) {
      toast({ message: messageOf(caught), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeck = async () => {
    if (!deletingDeck) return;
    setSaving(true);
    try {
      await removeDeck(deletingDeck.id);
      toast(`Deck "${deletingDeck.title}" dihapus.`);
      setDeletingDeck(null);
    } catch (caught) {
      toast({ message: messageOf(caught), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const quizTotalQuestions = quizzes.reduce(
    (total, set) => total + set.questions.length,
    0,
  );
  const body =
    activeQuiz !== null ? (
      <TakeQuizView quiz={activeQuiz} onExit={() => setTaking(null)} />
    ) : activeDeck !== null ? (
      <StudyModeView deck={activeDeck} onExit={() => setStudying(null)} />
    ) : (
      <>
        <div className={styles.toolbar}>
          <div className={styles.tabs} role="group" aria-label="Koleksi">
            {TABS.map(({ value, label, Icon }) => {
              const active = tab === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  className={`${styles.tab} ${active ? styles.tabActive : ''}`.trim()}
                  onClick={() => setTab(value)}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <Button variant="primary" onClick={() => generator.open()}>
            <SparkleIcon size={16} />
            Generate dengan AI
          </Button>
        </div>

        {tab === 'quizzes' ? (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.heading}>My Quizzes</h2>
              <p className={styles.subheading}>
                Kuis pilihan ganda dan jawaban singkat. Pilihan ganda
                dinilai otomatis; jawaban singkat diperiksa sendiri.
              </p>
            </div>

            {quizzes.length > 0 ? (
              <p className={styles.summary}>
                <ListIcon size={14} />
                {quizzes.length} set · {quizTotalQuestions} soal tersimpan
              </p>
            ) : null}

            <QuizSetList
              status={quizStatus}
              error={quizError}
              sets={quizzes}
              onRetry={() => void reloadQuizzes()}
              onGenerate={() => generator.open()}
              onOpen={openQuiz}
              onDelete={setDeletingQuiz}
            />
          </section>
        ) : (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.heading}>Flashcards</h2>
              <p className={styles.subheading}>
                Deck tanya-jawab dari materi Study Vault. Klik deck untuk
                mulai belajar.
              </p>
            </div>

            {decks.length > 0 ? (
              <p className={styles.summary}>
                <CardsIcon size={14} />
                {decks.length} deck ·{' '}
                {decks.reduce((total, deck) => total + deck.cards.length, 0)}{' '}
                kartu tersimpan
              </p>
            ) : null}

            <FlashcardDeckList
              status={deckStatus}
              error={deckError}
              decks={decks}
              onRetry={() => void reloadDecks()}
              onGenerate={() => generator.open()}
              onOpen={(deck) => void openStudyMode(deck)}
              onDelete={setDeletingDeck}
            />
          </section>
        )}
      </>
    );

  return (
    <>
      {body}

      <QuizGeneratorModal
        open={generator.isOpen}
        sourceMode={generator.sourceMode}
        onSourceModeChange={generator.setSourceMode}
        materials={generator.materials}
        materialId={generator.materialId}
        onMaterialChange={generator.setMaterialId}
        onFileChosen={(file) => void generator.loadFile(file)}
        isLoadingSource={generator.isLoadingSource}
        source={generator.source}
        urlText={generator.urlText}
        onUrlChange={generator.setUrlText}
        target={generator.target}
        onTargetChange={generator.setTarget}
        title={generator.title}
        onTitleChange={generator.setTitle}
        count={generator.count}
        counts={QUIZ_COUNTS}
        onCountChange={generator.setCount}
        apiKey={generator.apiKey}
        onApiKeyChange={generator.setApiKey}
        needsKey={generator.needsKey}
        isGenerating={generator.isGenerating}
        error={generator.error}
        onClose={generator.close}
        onSubmit={() => void handleGenerate()}
      />

      <ConfirmDialog
        open={deletingQuiz !== null}
        title="Hapus kuis?"
        message={
          deletingQuiz
            ? `"${deletingQuiz.title}" beserta seluruh soalnya akan dihapus.`
            : ''
        }
        confirmLabel="Hapus"
        pending={saving}
        onCancel={() => setDeletingQuiz(null)}
        onConfirm={() => void handleDeleteQuiz()}
      />

      <ConfirmDialog
        open={deletingDeck !== null}
        title="Hapus deck flashcard?"
        message={
          deletingDeck
            ? `"${deletingDeck.title}" beserta seluruh kartunya akan dihapus.`
            : ''
        }
        confirmLabel="Hapus"
        pending={saving}
        onCancel={() => setDeletingDeck(null)}
        onConfirm={() => void handleDeleteDeck()}
      />
    </>
  );
}
