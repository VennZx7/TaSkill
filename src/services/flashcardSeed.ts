import type { Flashcard, FlashcardDeck } from '../types/flashcard';
import { createId } from '../utils/id';

/** One seeded deck: a real revision set for a course the student is taking. */
interface Seed {
  title: string;
  cards: { question: string; answer: string }[];
}

/**
 * A short revision set so Study Mode is usable on first load. Kept in one file
 * with no logic, so it can be deleted in a single step.
 */
const SEEDS: Seed[] = [
  {
    title: 'Kalkulus Lanjut — Limit dan Kontinuitas',
    cards: [
      {
        question: 'Apa syarat fungsi kontinu di titik x = a?',
        answer:
          'Limit kiri dan limit kanan fungsi di a sama dengan nilai fungsi itu sendiri: lim x→a⁻ f(x) = lim x→a⁺ f(x) = f(a).',
      },
      {
        question: 'Bagaimana bentuk 0/0 saat menghitung limit fungsi rasional?',
        answer:
          'Dicoret lebih dulu dengan memfaktorkan pembilang dan penyebut, lalu hasilnya disubstitusi. Bentuk 0/0 tidak pernah langsung disubstitusi apa adanya.',
      },
      {
        question: 'Sebutkan teorema Squeeze.',
        answer:
          'Jika g(x) ≤ f(x) ≤ h(x) untuk semua x di sekitar a dan limit g dan h sama dengan L, maka limit f(x) = L.',
      },
      {
        question: 'Apa yang dimaksud fungsi kontinu pada interval tertutup [a, b]?',
        answer:
          'Kontinu di setiap titik pada interval tersebut, termasuk kontinu dari kanan di a dan dari kiri di b.',
      },
      {
        question: 'Kapan teorema kontinuitas bisa dipakai?',
        answer:
          'Jika f kontinu di a dan limit x→a g(x) = L, maka limit x→a f(g(x)) = f(L) — asalkan f kontinu di L.',
      },
      {
        question: 'Bagaimana membedakan limit tak hingga dan limit tak ada?',
        answer:
          'Kiri dan kanan sama-sama menuju +∞ atau −∞ berarti limit tak hingga. Kiri dan kanan berbeda tanda berarti limit tidak ada.',
      },
    ],
  },
];

function toCard(value: { question: string; answer: string }): Flashcard {
  return { id: createId(), question: value.question, answer: value.answer };
}

export function buildSeedDecks(now: number = Date.now()): FlashcardDeck[] {
  return SEEDS.map((seed) => ({
    id: createId(),
    title: seed.title,
    // Seeds are not tied to a saved material; a real deck records its source.
    vaultItemId: null,
    cards: seed.cards.map(toCard),
    createdAt: new Date(now).toISOString(),
    lastStudied: null,
  }));
}
