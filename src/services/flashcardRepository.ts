import type { Flashcard, FlashcardDeck } from '../types/flashcard';
import { createId } from '../utils/id';
import { StorageError, readJson, writeJson } from './localStorage';
import { buildSeedDecks } from './flashcardSeed';

const STORAGE_KEY = 'student-tasks:flashcards';

/** Caps a hand-edited or corrupted record so one bad deck cannot flood the UI. */
const MAX_CARDS = 60;

function isoOrNull(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function normalizeCard(value: unknown): Flashcard | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.question !== 'string' || typeof raw.answer !== 'string') return null;
  if (raw.question.trim().length === 0 || raw.answer.trim().length === 0) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createId(),
    question: raw.question.trim(),
    answer: raw.answer.trim(),
  };
}

/** Repairs a stored record so a partial deck becomes a valid FlashcardDeck. */
function normalizeDeck(value: unknown): FlashcardDeck | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.title !== 'string' || raw.title.trim().length === 0) return null;

  const cards = Array.isArray(raw.cards)
    ? raw.cards.slice(0, MAX_CARDS).flatMap((entry) => {
        const card = normalizeCard(entry);
        return card ? [card] : [];
      })
    : [];

  return {
    id: raw.id,
    title: raw.title.trim(),
    vaultItemId: typeof raw.vaultItemId === 'string' && raw.vaultItemId ? raw.vaultItemId : null,
    cards,
    createdAt: isoOrNull(raw.createdAt) ?? new Date().toISOString(),
    lastStudied: isoOrNull(raw.lastStudied),
  };
}

function parseStored(raw: unknown): FlashcardDeck[] {
  if (!Array.isArray(raw)) {
    throw new StorageError('malformed', 'Data flashcard tersimpan rusak dan tidak dapat dibaca.');
  }
  return raw.flatMap((entry) => {
    const deck = normalizeDeck(entry);
    return deck ? [deck] : [];
  });
}

function loadAll(): FlashcardDeck[] {
  const raw = readJson<unknown>(STORAGE_KEY);

  // Same rule as the vault: an absent key is a first run and gets seeded, while
  // an explicit empty array means the student deleted every deck.
  if (raw === null) {
    const seeded = buildSeedDecks();
    writeJson(STORAGE_KEY, seeded);
    return seeded;
  }

  return parseStored(raw);
}

function saveAll(decks: FlashcardDeck[]): void {
  writeJson(STORAGE_KEY, decks);
}

export const flashcardRepository = {
  readAll(): FlashcardDeck[] {
    return loadAll();
  },

  insert(deck: FlashcardDeck): FlashcardDeck[] {
    const decks = loadAll();
    decks.unshift(deck);
    saveAll(decks);
    return decks;
  },

  update(deck: FlashcardDeck): FlashcardDeck[] {
    const decks = loadAll();
    const index = decks.findIndex((entry) => entry.id === deck.id);
    if (index !== -1) {
      decks[index] = deck;
      saveAll(decks);
    }
    return decks;
  },

  remove(id: string): FlashcardDeck[] {
    const remaining = loadAll().filter((deck) => deck.id !== id);
    saveAll(remaining);
    return remaining;
  },
};
