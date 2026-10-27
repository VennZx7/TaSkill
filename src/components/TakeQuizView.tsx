import { useMemo, useState } from 'react';
import { useQuizzes } from '../context/QuizContext';
import type { QuizSet } from '../types/quiz';
import { formatToWIB } from '../utils/date';
import { TaskServiceError } from '../services/errors';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Textarea } from './ui/Field';
import { useToast } from './ui/Toast';
import { CheckCircleIcon, RefreshIcon, XIcon } from './ui/icons';
import styles from './TakeQuizView.module.css';

interface TakeQuizViewProps {
  quiz: QuizSet;
  onExit: () => void;
}

function messageOf(error: unknown): string {
  if (error instanceof TaskServiceError) return error.message;
  return 'Terjadi kesalahan tak terduga. Coba lagi.';
}

/**
 * Takes one quiz. Choice questions are auto-scored
 * against the stored correct option; short answers are
 * revealed for self-check. Submitting stamps lastStudied
 * through the service so the progress persists.
 */
export function TakeQuizView({ quiz, onExit }: TakeQuizViewProps) {
  const toast = useToast();
  const { markStudied } = useQuizzes();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const choiceQuestions = useMemo(
    () => quiz.questions.filter((question) => question.kind === 'choice'),
    [quiz.questions],
  );

  /** Pure derivation of the score — never stored in state. */
  const score = useMemo(() => {
    const correct = choiceQuestions.filter((question) => {
      const chosen = (answers[question.id] ?? '').trim().toLowerCase();
      return (
        chosen.length > 0 &&
        chosen === question.options[question.correctIndex].trim().toLowerCase()
      );
    }).length;
    return { correct, total: choiceQuestions.length };
  }, [answers, choiceQuestions]);

  const setAnswer = (id: string, value: string) =>
    setAnswers((previous) => ({ ...previous, [id]: value }));

  const submit = async () => {
    const unanswered = quiz.questions.filter(
      (question) => (answers[question.id] ?? '').trim().length === 0,
    );
    if (unanswered.length > 0) {
      toast({
        message: `${unanswered.length} soal belum dijawab. Isi dulu sebelum mengumpulkan.`,
        tone: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitted(true);
    toast(`Kuis selesai. Skor ${score.correct} dari ${score.total}.`);
    try {
      await markStudied(quiz.id);
    } catch (caught) {
      toast({ message: messageOf(caught), tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const retry = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <section className={styles.root} aria-label={`Kuis — ${quiz.title}`}>
      <header className={styles.header}>
        <div className={styles.headline}>
          <h2 className={styles.title}>{quiz.title}</h2>
          <span className={styles.meta}>
            {quiz.lastStudied
              ? `Terakhir dikerjakan ${formatToWIB(quiz.lastStudied)} WIB`
              : 'Sesi kuis baru'}
          </span>
        </div>
        <div className={styles.headerActions}>
          <Badge tone="accent">{quiz.questions.length} soal</Badge>
          <Button variant="ghost" size="sm" onClick={onExit}>
            Kembali ke daftar
          </Button>
        </div>
      </header>

      {submitted ? (
        <div
          className={`${styles.scoreCard} ${
            score.correct === score.total && score.total > 0
              ? styles.scorePerfect
              : ''
          }`}
        >
          <span
            className={styles.scoreIcon}
            aria-hidden="true"
          >
            {score.correct === score.total && score.total > 0 ? (
              <CheckCircleIcon size={20} />
            ) : (
              <RefreshIcon size={20} />
            )}
          </span>
          <div>
            <p className={styles.scoreValue}>
              Skor: {score.correct} dari {score.total} soal pilihan ganda
            </p>
            <p className={styles.scoreNote}>
              Soal jawaban singkat ditampilkan di bawah untuk pemeriksaan
              sendiri.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={retry}>
            <RefreshIcon size={14} />
            Kerjakan ulang
          </Button>
        </div>
      ) : null}

      <ol className={styles.questions}>
        {quiz.questions.map((question, index) => {
          const chosen = answers[question.id] ?? '';
          const isChoice = question.kind === 'choice';
          const isCorrect =
            isChoice &&
            submitted &&
            chosen.trim().toLowerCase() ===
              question.options[question.correctIndex].trim().toLowerCase();

          return (
            <li key={question.id} className={styles.question}>
              <div className={styles.questionHead}>
                <span className={styles.number}>Soal {index + 1}</span>
                <Badge tone={isChoice ? 'accent' : 'neutral'}>
                  {isChoice ? 'Pilihan ganda' : 'Jawaban singkat'}
                </Badge>
                {isChoice && submitted ? (
                  isCorrect ? (
                    <Badge tone="success" dot>
                      Benar
                    </Badge>
                  ) : (
                    <Badge tone="danger" dot>
                      Salah
                    </Badge>
                  )
                ) : null}
              </div>

              <p className={styles.prompt}>{question.prompt}</p>

              {isChoice ? (
                <div
                  className={styles.options}
                  role="radiogroup"
                  aria-label={`Pilihan soal ${index + 1}`}
                >
                  {question.options.map((option, optionIndex) => {
                    const isChosen = chosen === option;
                    const isKey = optionIndex === question.correctIndex;
                    const className = `${styles.option} ${
                      isChosen ? styles.optionChosen : ''
                    } ${submitted && isKey ? styles.optionKey : ''} ${
                      submitted && isChosen && !isKey ? styles.optionWrong : ''
                    }`.trim();
                    return (
                      <label key={optionIndex} className={className}>
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          className={styles.radio}
                          checked={isChosen}
                          disabled={submitted}
                          onChange={() => setAnswer(question.id, option)}
                        />
                        <span className={styles.optionLetter}>
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span className={styles.optionText}>{option}</span>
                        {submitted && isKey ? (
                          <CheckCircleIcon size={15} className={styles.optionMark} />
                        ) : null}
                        {submitted && isChosen && !isKey ? (
                          <XIcon size={15} className={styles.optionMark} />
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <Textarea
                  label="Jawabanmu"
                  rows={2}
                  value={chosen}
                  disabled={submitted}
                  placeholder="Tulis jawabanmu…"
                  hint={submitted ? 'Jawaban model ditampilkan di bawah.' : undefined}
                  onChange={(event) => setAnswer(question.id, event.target.value)}
                />
              )}

              {submitted && !isChoice ? (
                <div className={styles.modelAnswer}>
                  <span className={styles.modelLabel}>Jawaban model</span>
                  <p className={styles.modelText}>{question.answer}</p>
                </div>
              ) : null}

              {submitted && question.explanation.length > 0 ? (
                <p className={styles.explanation}>
                  <span className={styles.explanationLabel}>Pembahasan</span>
                  {question.explanation}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {submitted ? null : (
        <footer className={styles.footer}>
          <Button variant="primary" onClick={() => void submit()} disabled={isSubmitting}>
            Kumpulkan jawaban
          </Button>
        </footer>
      )}
    </section>
  );
}
