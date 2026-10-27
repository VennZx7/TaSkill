import type { QuizSet, QuizSetDraft } from '../types/quiz';
import { createId } from '../utils/id';

/** One seeded set: a real revision quiz for a course the student is taking. */
interface Seed {
  title: string;
  questions: QuizSetDraft['questions'];
}

/**
 * A short revision quiz so the Quiz tab is usable on first load.
 * Kept in one file with no logic, so it can be deleted in a
 * single step.
 */
const SEEDS: Seed[] = [
  {
    title: 'Kalkulus Lanjut — Limit dan Kontinuitas',
    questions: [
      {
        kind: 'choice',
        prompt: 'Apa syarat fungsi f kontinu di titik x = a?',
        options: [
          'Limit kiri dan limit kanan di a ada, tetapi boleh berbeda',
          'Limit kiri, limit kanan, dan nilai f(a) semuanya ada dan sama',
          'f(a) harus nol',
          'Fungsi harus turunan di a',
        ],
        correctIndex: 1,
        explanation:
          'Kontinu di a berarti lim x→a⁻ f(x) = lim x→a⁺ f(x) = f(a): kedua limit searah ada dan sama dengan nilai fungsinya.',
      },
      {
        kind: 'choice',
        prompt: 'Bentuk 0/0 pada limit fungsi rasional diselesaikan dengan…',
        options: [
          'Langsung substitusi x = a',
          'Mencoret faktor yang sama pada pembilang dan penyebut',
          'Mengalikan dengan nol',
          'Menjumlahkan kedua ruas',
        ],
        correctIndex: 1,
        explanation:
          'Bentuk tak tentu 0/0 dicoret lebih dulu dengan memfaktorkan, lalu hasilnya disubstitusi — substitusi langsung tidak pernah valid untuk 0/0.',
      },
      {
        kind: 'short',
        prompt: 'Nyatakan teorema Squeeze dalam satu kalimat.',
        answer:
          'Jika g(x) ≤ f(x) ≤ h(x) di sekitar a dan limit g serta limit h sama dengan L, maka limit f(x) = L.',
        explanation:
          'Squeeze memaksa limit f berada di antara dua limit yang sudah diketahui sama.',
      },
      {
        kind: 'choice',
        prompt: 'Kapan teorema kontinuitas komposisi f(g(x)) bisa dipakai?',
        options: [
          'Jika g kontinu di a dan f kontinu di g(a)',
          'Jika f dan g keduanya turunan',
          'Jika g(a) = 0',
          'Jika f kontinu di mana pun',
        ],
        correctIndex: 0,
        explanation:
          'Limit x→a f(g(x)) = f(limit x→a g(x)) berlaku jika g kontinu di a dan f kontinu di g(a).',
      },
      {
        kind: 'short',
        prompt: 'Bagaimana membedakan limit tak hingga dari limit yang tidak ada?',
        answer:
          'Limit tak hingga: kiri dan kanan sama-sama menuju +∞ atau −∞. Limit tidak ada: kiri dan kanan berbeda tanda atau berosilasi.',
        explanation:
          'Menuju tak hingga searah masih disebut limit tak hingga; berbeda arah berarti limit tidak ada.',
      },
    ],
  },
];

export function buildSeedQuizzes(now: number = Date.now()): QuizSet[] {
  return SEEDS.map((seed) => ({
    id: createId(),
    title: seed.title,
    // Seeds are not tied to a saved material; a real set records its source.
    materialId: null,
    questions: seed.questions.map((question) =>
      question.kind === 'choice'
        ? { ...question, id: createId() }
        : { ...question, id: createId() },
    ),
    createdAt: new Date(now).toISOString(),
    lastStudied: null,
  }));
}
