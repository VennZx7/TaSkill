import type { FlashcardDeck, FlashcardDeckDraft } from '../types/flashcard';
import { createId } from '../utils/id';
import { validateFlashcardDeckDraft } from '../utils/validation';
import { NotFoundError, ValidationError } from './errors';
import { flashcardRepository } from './flashcardRepository';
import { SERVICE_LATENCY_MS as LATENCY_MS, toServiceError, wait } from './shared';

/** Validates a draft and returns the cleaned value, or throws a typed error. */
function prepare(draft: FlashcardDeckDraft): FlashcardDeckDraft {
  const result = validateFlashcardDeckDraft(draft);
  if (!result.ok) throw new ValidationError(result.errors);
  return result.value;
}

function findOrThrow(id: string): FlashcardDeck {
  const found = flashcardRepository.readAll().find((deck) => deck.id === id);
  if (!found) throw new NotFoundError('Deck flashcard tidak ditemukan. Mungkin sudah dihapus.');
  return found;
}

export async function listDecks(): Promise<FlashcardDeck[]> {
  await wait(LATENCY_MS);
  try {
    return flashcardRepository.readAll();
  } catch (error) {
    throw toServiceError(error);
  }
}

/** Ids and timestamps are minted here so no caller can hand-write them. */
export async function createDeck(draft: FlashcardDeckDraft): Promise<FlashcardDeck> {
  await wait(LATENCY_MS);
  const value = prepare(draft);

  const deck: FlashcardDeck = {
    id: createId(),
    title: value.title,
    vaultItemId: value.vaultItemId,
    cards: value.cards.map((card) => ({ id: createId(), ...card })),
    createdAt: new Date().toISOString(),
    lastStudied: null,
  };

  try {
    flashcardRepository.insert(deck);
  } catch (error) {
    throw toServiceError(error);
  }
  return deck;
}

export async function deleteDeck(id: string): Promise<void> {
  await wait(LATENCY_MS);
  try {
    flashcardRepository.remove(id);
  } catch (error) {
    throw toServiceError(error);
  }
}

/** Records that Study Mode was opened, so the deck list can sort by recency. */
export async function markDeckStudied(id: string): Promise<FlashcardDeck> {
  await wait(LATENCY_MS);
  const deck: FlashcardDeck = { ...findOrThrow(id), lastStudied: new Date().toISOString() };
  try {
    flashcardRepository.update(deck);
  } catch (error) {
    throw toServiceError(error);
  }
  return deck;
}
