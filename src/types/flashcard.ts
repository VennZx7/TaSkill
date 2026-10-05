/** How many cards a generation request asks for. Offered as a fixed list so the
 *  value is always a known option rather than free-form user input. */
export const FLASHCARD_COUNTS = [5, 8, 10, 12, 15] as const;

export type FlashcardCount = (typeof FLASHCARD_COUNTS)[number];

/** One question/answer pair. `id` is system-owned, minted by the service. */
export interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

/**
 * A saved study deck. `vaultItemId` is null for a deck that was not built from a
 * saved material, and `lastStudied` is null until Study Mode is opened once.
 * Both are explicit nulls rather than optional fields so the stored shape is
 * uniform across every deck.
 */
export interface FlashcardDeck {
  id: string;
  title: string;
  vaultItemId: string | null;
  cards: Flashcard[];
  createdAt: string;
  lastStudied: string | null;
}

/** The only fields a caller may set. Ids and timestamps are system-owned. */
export interface FlashcardDeckDraft {
  title: string;
  vaultItemId: string | null;
  cards: Array<{ question: string; answer: string }>;
}

export function isFlashcardCount(value: unknown): value is FlashcardCount {
  return typeof value === 'number' && (FLASHCARD_COUNTS as readonly number[]).includes(value);
}
