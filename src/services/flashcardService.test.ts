import { beforeEach, describe, expect, it } from 'vitest';
import type { FlashcardDeckDraft } from '../types/flashcard';
import { createDeck, deleteDeck, listDecks, markDeckStudied } from './flashcardService';

const STORAGE_KEY = 'student-tasks:flashcards';

function stored(): Array<Record<string, unknown>> {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string) as Array<Record<string, unknown>>;
}

function draft(overrides: Partial<FlashcardDeckDraft> = {}): FlashcardDeckDraft {
  return {
    title: 'Kalkulus Lanjut — Limit',
    vaultItemId: 'v1',
    cards: [
      { question: 'Apa syarat kontinu di x = a?', answer: 'Limit kiri = limit kanan = nilai fungsi.' },
      { question: 'Apa itu teorema Squeeze?', answer: 'Mengapit limit dengan dua fungsi.' },
    ],
    ...overrides,
  };
}

/** Starts from an explicitly empty store, so seed data never leaks into a count. */
function emptyDecks() {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEY, '[]');
}

describe('flashcardService CRUD', () => {
  beforeEach(emptyDecks);

  it('seeds on first run and keeps a cleared list empty', async () => {
    window.localStorage.clear();
    const seeded = await listDecks();
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.every((deck) => deck.cards.length > 0)).toBe(true);

    for (const deck of seeded) await deleteDeck(deck.id);

    // An explicit empty array means "the student deleted them", not "first run".
    expect(stored()).toEqual([]);
    expect(await listDecks()).toEqual([]);
  });

  it('creates a deck with minted card ids and system-owned timestamps', async () => {
    const created = await createDeck(draft());

    expect(created.id).toBeTruthy();
    expect(created.lastStudied).toBeNull();
    expect(created.vaultItemId).toBe('v1');
    expect(Number.isFinite(Date.parse(created.createdAt))).toBe(true);
    expect(created.cards.every((card) => card.id.length > 0)).toBe(true);
    expect(new Set(created.cards.map((card) => card.id)).size).toBe(2);
    expect(stored()).toHaveLength(1);
  });

  it('rejects a blank title and a deck with no usable card', async () => {
    await expect(createDeck({ ...draft(), title: '   ' })).rejects.toThrow();
    await expect(createDeck({ ...draft(), cards: [{ question: ' ', answer: '' }] })).rejects.toThrow();
    expect(stored()).toHaveLength(0);
  });

  it('drops a half-filled card instead of storing an empty face', async () => {
    const created = await createDeck(
      draft({
        cards: [
          { question: '  Definisi limit?  ', answer: '  Nilai mendekati suatu bilangan.  ' },
          { question: '', answer: 'Jawaban tanpa pertanyaan' },
          { question: 'Pertanyaan tanpa jawaban', answer: '   ' },
        ],
      }),
    );

    expect(created.cards).toEqual([
      { id: expect.any(String), question: 'Definisi limit?', answer: 'Nilai mendekati suatu bilangan.' },
    ]);
  });

  it('stamps lastStudied and persists it', async () => {
    const created = await createDeck(draft());

    const studied = await markDeckStudied(created.id);

    expect(studied.lastStudied).not.toBeNull();
    expect(Number.isFinite(Date.parse(studied.lastStudied as string))).toBe(true);
    expect(stored()[0].lastStudied).toBe(studied.lastStudied);
    // The deck itself is otherwise untouched.
    expect(stored()[0].createdAt).toBe(created.createdAt);
  });

  it('deletes only the target and is safe to repeat', async () => {
    const keep = await createDeck(draft({ title: 'Deck A' }));
    const drop = await createDeck(draft({ title: 'Deck B' }));

    await deleteDeck(drop.id);
    await deleteDeck(drop.id);

    const remaining = await listDecks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(keep.id);
  });

  it('throws NotFoundError for an unknown id instead of writing a blank record', async () => {
    await expect(markDeckStudied('tidak-ada')).rejects.toThrow(/tidak ditemukan/i);
    expect(stored()).toHaveLength(0);
  });
});

describe('flashcardService repair of stored records', () => {
  it('repairs a partial record and rejects a malformed payload', async () => {
    window.localStorage.clear();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'd1',
          title: '  Struktur Data  ',
          cards: [
            { id: 'c1', question: 'Apa itu BST?', answer: 'Binary Search Tree' },
            { question: 'tanpa answer' },
            'bukan objek',
          ],
        },
        { title: 'tanpa id' },
      ]),
    );

    const decks = await listDecks();

    expect(decks).toHaveLength(1);
    expect(decks[0].title).toBe('Struktur Data');
    expect(decks[0].cards).toHaveLength(1);
    expect(decks[0].vaultItemId).toBeNull();
    expect(decks[0].lastStudied).toBeNull();
    expect(Number.isFinite(Date.parse(decks[0].createdAt))).toBe(true);

    window.localStorage.setItem(STORAGE_KEY, '{bukan json');
    await expect(listDecks()).rejects.toThrow(/rusak/i);
  });
});
