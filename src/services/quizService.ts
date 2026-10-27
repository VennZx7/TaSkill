import type { QuizSet, QuizSetDraft } from '../types/quiz';
import { createId } from '../utils/id';
import { validateQuizSetDraft } from '../utils/validation';
import { NotFoundError, ValidationError } from './errors';
import { quizRepository } from './quizRepository';
import { SERVICE_LATENCY_MS as LATENCY_MS, toServiceError, wait } from './shared';

/** Validates a draft and returns the cleaned value, or throws a typed error. */
function prepare(draft: QuizSetDraft): QuizSetDraft {
  const result = validateQuizSetDraft(draft);
  if (!result.ok) throw new ValidationError(result.errors);
  return result.value;
}

function findOrThrow(id: string): QuizSet {
  const found = quizRepository.readAll().find((set) => set.id === id);
  if (!found) throw new NotFoundError('Kuis tidak ditemukan. Mungkin sudah dihapus.');
  return found;
}

export async function listQuizzes(): Promise<QuizSet[]> {
  await wait(LATENCY_MS);
  try {
    return quizRepository.readAll();
  } catch (error) {
    throw toServiceError(error);
  }
}

/** Ids and timestamps are minted here so no caller can hand-write them. */
export async function createQuiz(draft: QuizSetDraft): Promise<QuizSet> {
  await wait(LATENCY_MS);
  const value = prepare(draft);

  const set: QuizSet = {
    id: createId(),
    title: value.title,
    materialId: value.materialId,
    questions: value.questions.map((question) =>
      question.kind === 'choice'
        ? { ...question, id: createId() }
        : { ...question, id: createId() },
    ),
    createdAt: new Date().toISOString(),
    lastStudied: null,
  };

  try {
    quizRepository.insert(set);
  } catch (error) {
    throw toServiceError(error);
  }
  return set;
}

export async function deleteQuiz(id: string): Promise<void> {
  await wait(LATENCY_MS);
  try {
    quizRepository.remove(id);
  } catch (error) {
    throw toServiceError(error);
  }
}

/** Records that a quiz was submitted, so the list can sort by recency. */
export async function markQuizStudied(id: string): Promise<QuizSet> {
  await wait(LATENCY_MS);
  const set: QuizSet = { ...findOrThrow(id), lastStudied: new Date().toISOString() };
  try {
    quizRepository.update(set);
  } catch (error) {
    throw toServiceError(error);
  }
  return set;
}
