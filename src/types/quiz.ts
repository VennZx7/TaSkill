/** How many questions a generation request asks for. Same fixed list
 *  as the flashcard counts so one select serves both generators. */
export const QUIZ_COUNTS = [5, 8, 10, 12, 15] as const;

export type QuizCount = (typeof QUIZ_COUNTS)[number];

export type QuizQuestionKind = 'choice' | 'short';

/**
 * One quiz question. The union is discriminated on `kind` so a
 * choice question carries its options and a short-answer question
 * carries the model answer — never both, never neither. `id` is
 * system-owned, minted by the service.
 */
export interface ChoiceQuestion {
  id: string;
  kind: 'choice';
  prompt: string;
  options: string[];
  /** Index into `options`. */
  correctIndex: number;
  explanation: string;
}

export interface ShortQuestion {
  id: string;
  kind: 'short';
  prompt: string;
  /** The model answer, revealed for self-check after submitting. */
  answer: string;
  explanation: string;
}

export type QuizQuestion = ChoiceQuestion | ShortQuestion;

/**
 * A saved quiz set. `materialId` is null for a set that was not
 * built from a saved material, and `lastStudied` is null until the
 * quiz is submitted once. Both are explicit nulls so the stored
 * shape is uniform across every set.
 */
export interface QuizSet {
  id: string;
  title: string;
  materialId: string | null;
  questions: QuizQuestion[];
  createdAt: string;
  lastStudied: string | null;
}

/** The only fields a caller may set. Ids and timestamps are system-owned. */
export interface QuizSetDraft {
  title: string;
  materialId: string | null;
  questions: Array<
    | {
        kind: 'choice';
        prompt: string;
        options: string[];
        correctIndex: number;
        explanation: string;
      }
    | { kind: 'short'; prompt: string; answer: string; explanation: string }
  >;
}

export function isQuizCount(value: unknown): value is QuizCount {
  return typeof value === 'number' && (QUIZ_COUNTS as readonly number[]).includes(value);
}
