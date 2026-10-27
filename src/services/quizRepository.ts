import type { QuizQuestion, QuizSet } from '../types/quiz';
import { createId } from '../utils/id';
import { StorageError, readJson, writeJson } from './localStorage';
import { buildSeedQuizzes } from './quizSeed';

const STORAGE_KEY = 'student-tasks:quizzes';

/** Caps a hand-edited or corrupted record so one bad set cannot flood the UI. */
const MAX_QUESTIONS = 40;
/** Options beyond four are almost always a malformed model reply. */
const MAX_OPTIONS = 6;

function isoOrNull(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function normalizeQuestion(value: unknown): QuizQuestion | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.prompt !== 'string' || raw.prompt.trim().length === 0) return null;
  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';

  if (raw.kind === 'choice') {
    if (!Array.isArray(raw.options)) return null;
    const options = raw.options
      .filter((option): option is string => typeof option === 'string')
      .map((option) => option.trim())
      .filter((option) => option.length > 0)
      .slice(0, MAX_OPTIONS);
    if (options.length < 2) return null;
    if (typeof raw.correctIndex !== 'number') return null;
    if (!Number.isInteger(raw.correctIndex) || raw.correctIndex < 0 || raw.correctIndex >= options.length) {
      return null;
    }
    return {
      id: raw.id,
      kind: 'choice',
      prompt: raw.prompt.trim(),
      options,
      correctIndex: raw.correctIndex,
      explanation,
    };
  }

  if (raw.kind === 'short') {
    if (typeof raw.answer !== 'string' || raw.answer.trim().length === 0) return null;
    return {
      id: raw.id,
      kind: 'short',
      prompt: raw.prompt.trim(),
      answer: raw.answer.trim(),
      explanation,
    };
  }

  return null;
}

/** Repairs a stored record so a partial set becomes a valid QuizSet. */
function normalizeSet(value: unknown): QuizSet | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.title !== 'string' || raw.title.trim().length === 0) return null;

  const questions = Array.isArray(raw.questions)
    ? raw.questions.slice(0, MAX_QUESTIONS).flatMap((entry) => {
        const question = normalizeQuestion(entry);
        return question ? [question] : [];
      })
    : [];

  return {
    id: raw.id,
    title: raw.title.trim(),
    materialId: typeof raw.materialId === 'string' && raw.materialId ? raw.materialId : null,
    questions,
    createdAt: isoOrNull(raw.createdAt) ?? new Date().toISOString(),
    lastStudied: isoOrNull(raw.lastStudied),
  };
}

function parseStored(raw: unknown): QuizSet[] {
  if (!Array.isArray(raw)) {
    throw new StorageError('malformed', 'Data kuis tersimpan rusak dan tidak dapat dibaca.');
  }
  return raw.flatMap((entry) => {
    const set = normalizeSet(entry);
    return set ? [set] : [];
  });
}

function loadAll(): QuizSet[] {
  const raw = readJson<unknown>(STORAGE_KEY);

  // Same rule as the vault: an absent key is a first run and gets seeded, while
  // an explicit empty array means the student deleted every set.
  if (raw === null) {
    const seeded = buildSeedQuizzes();
    writeJson(STORAGE_KEY, seeded);
    return seeded;
  }

  return parseStored(raw);
}

function saveAll(sets: QuizSet[]): void {
  writeJson(STORAGE_KEY, sets);
}

export const quizRepository = {
  readAll(): QuizSet[] {
    return loadAll();
  },

  insert(set: QuizSet): QuizSet[] {
    const sets = loadAll();
    sets.unshift(set);
    saveAll(sets);
    return sets;
  },

  update(set: QuizSet): QuizSet[] {
    const sets = loadAll();
    const index = sets.findIndex((entry) => entry.id === set.id);
    if (index !== -1) {
      sets[index] = set;
      saveAll(sets);
    }
    return sets;
  },

  remove(id: string): QuizSet[] {
    const remaining = loadAll().filter((set) => set.id !== id);
    saveAll(remaining);
    return remaining;
  },
};
