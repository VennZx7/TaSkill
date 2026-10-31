import { isItemType, isTaskPriority, isTaskStatus, type ItemDraft } from '../types/item';
import type { FlashcardDeckDraft } from '../types/flashcard';
import type { QuizSetDraft } from '../types/quiz';
import { isVaultType, MAX_VAULT_CHARS, MAX_VAULT_SOURCES, type VaultDraft } from '../types/vault';
import { CRITICAL_THRESHOLD_MS, inputValueToInstant, inputValueToStorageISO } from './date';

export interface ValidationSuccess {
  ok: true;
  value: ItemDraft;
  warnings: string[];
}

export interface ValidationFailure {
  ok: false;
  errors: Record<string, string>;
  warnings: string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export const TITLE_MAX_LENGTH = 100;

/**
 * Validates a form draft. Never throws: an empty deadline is a hard error,
 * a deadline entirely in the past is a warning that still allows saving.
 */
export function validateItemDraft(draft: ItemDraft, now: number = Date.now()): ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];

  if (!isItemType(draft.type)) {
    errors.type = 'Jenis item tidak valid.';
  }

  const title = draft.title.trim();
  if (title.length === 0) {
    errors.title = 'Judul wajib diisi.';
  } else if (title.length > TITLE_MAX_LENGTH) {
    errors.title = `Judul maksimal ${TITLE_MAX_LENGTH} karakter.`;
  }

  const course = draft.course.trim();
  if (course.length === 0) {
    errors.course = 'Mata kuliah wajib diisi.';
  }

  const rawDeadline = draft.deadline.trim();
  if (rawDeadline.length === 0) {
    errors.deadline = 'Deadline wajib diisi.';
  } else {
    const instant = inputValueToInstant(rawDeadline);
    if (instant === null || inputValueToStorageISO(rawDeadline) === null) {
      errors.deadline = 'Format deadline tidak valid.';
    } else if (instant < now) {
      warnings.push('Deadline ini sudah lewat. Item akan ditandai sebagai overdue.');
    } else if (instant - now < CRITICAL_THRESHOLD_MS) {
      warnings.push('Deadline kurang dari 24 jam lagi.');
    }
  }

  if (!isTaskPriority(draft.priority)) {
    errors.priority = 'Prioritas tidak valid.';
  }

  if (!isTaskStatus(draft.status)) {
    errors.status = 'Status tidak valid.';
  }

  // Duplicate titles are legal, so only a blank chapter is rejected.
  if (draft.subtasks.some((subtask) => subtask.title.trim().length === 0)) {
    errors.subtasks = 'Nama bab tidak boleh kosong.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, warnings };
  }

  return {
    ok: true,
    warnings,
    value: {
      type: draft.type,
      title,
      course,
      description: draft.description.trim(),
      deadline: rawDeadline,
      priority: draft.priority,
      status: draft.status,
      subtasks: draft.subtasks.map((subtask) => ({
        ...subtask,
        title: subtask.title.trim(),
      })),
    },
  };
}

/**
 * Normalizes a tag list: trims, drops blanks, and removes case-insensitive
 * duplicates while keeping the first spelling the student typed. Tag filtering
 * compares case-insensitively, so a duplicate would be an invisible second chip.
 */
export function normalizeTagList(tags: string[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const tag of tags) {
    const value = tag.trim();
    if (value.length === 0) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(value);
  }
  return clean;
}

export type VaultResult =
  | { ok: true; value: VaultDraft }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates a vault draft. Never throws. A link must parse as an http(s) URL;
 * a note or document only needs non-empty text. There is no warning case —
 * unlike an item, a saved material has no deadline that can silently go stale.
 */
export function validateVaultDraft(draft: VaultDraft): VaultResult {
  const errors: Record<string, string> = {};

  if (!isVaultType(draft.type)) {
    errors.type = 'Jenis materi tidak valid.';
  }

  const title = draft.title.trim();
  if (title.length === 0) {
    errors.title = 'Judul wajib diisi.';
  } else if (title.length > TITLE_MAX_LENGTH) {
    errors.title = `Judul maksimal ${TITLE_MAX_LENGTH} karakter.`;
  }

  const course = draft.course.trim();
  if (course.length === 0) {
    errors.course = 'Mata kuliah wajib diisi.';
  }

  const content = draft.urlOrContent.trim();
  if (content.length === 0) {
    errors.urlOrContent = draft.type === 'link' ? 'Tautan wajib diisi.' : 'Isi wajib diisi.';
  } else if (draft.type === 'link') {
    let protocol: string | null = null;
    try {
      protocol = new URL(content).protocol;
    } catch {
      errors.urlOrContent = 'Tautan tidak valid.';
    }
    if (protocol !== null && protocol !== 'http:' && protocol !== 'https:') {
      errors.urlOrContent = 'Tautan harus diawali http:// atau https://';
    }
  } else if (content.length > MAX_VAULT_CHARS) {
    errors.urlOrContent = `Teks terlalu besar (maks ${MAX_VAULT_CHARS.toLocaleString('id')} karakter). Kurangi jumlah atau ukuran berkas.`;
  }

  const sources = draft.type === 'link' ? [] : (draft.sources ?? []);
  if (sources.length > MAX_VAULT_SOURCES) {
    errors.sources = `Maksimal ${MAX_VAULT_SOURCES} berkas per materi.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      title,
      course,
      urlOrContent: content,
      type: draft.type,
      tags: normalizeTagList(draft.tags),
      sources,
    },
  };
}

export type FlashcardDeckResult =
  | { ok: true; value: FlashcardDeckDraft }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates a deck before it is saved. Never throws. A card missing a question
 * or an answer is dropped instead of being stored blank, and a deck with no
 * usable card left is a hard error — an empty deck has nothing to study.
 */
export function validateFlashcardDeckDraft(draft: FlashcardDeckDraft): FlashcardDeckResult {
  const errors: Record<string, string> = {};

  const title = draft.title.trim();
  if (title.length === 0) {
    errors.title = 'Judul deck wajib diisi.';
  } else if (title.length > TITLE_MAX_LENGTH) {
    errors.title = `Judul maksimal ${TITLE_MAX_LENGTH} karakter.`;
  }

  const cards = draft.cards.flatMap((card) => {
    const question = card.question.trim();
    const answer = card.answer.trim();
    return question.length > 0 && answer.length > 0 ? [{ question, answer }] : [];
  });

  if (cards.length === 0) {
    errors.cards = 'Deck harus punya minimal satu kartu yang terisi.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: { title, vaultItemId: draft.vaultItemId, cards } };
}

export type QuizSetResult =
  | { ok: true; value: QuizSetDraft }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates a quiz set before it is saved. Never throws. A
 * question missing a prompt or an answer is dropped, a choice
 * question needs at least two options and an answer that names
 * one of them, and a set with no usable question left is a
 * hard error — an empty quiz has nothing to take.
 */
export function validateQuizSetDraft(draft: QuizSetDraft): QuizSetResult {
  const errors: Record<string, string> = {};

  const title = draft.title.trim();
  if (title.length === 0) {
    errors.title = 'Judul kuis wajib diisi.';
  } else if (title.length > TITLE_MAX_LENGTH) {
    errors.title = `Judul maksimal ${TITLE_MAX_LENGTH} karakter.`;
  }

  const questions = draft.questions.flatMap((question) => {
    const prompt = question.prompt.trim();
    const explanation = question.explanation.trim();
    if (prompt.length === 0) return [];

    const topic = question.topic?.trim();
    const extra = topic ? { topic } : {};

    if (question.kind === 'choice') {
      const options = question.options
        .map((option) => option.trim())
        .filter((option) => option.length > 0);
      const answer = question.options[question.correctIndex]?.trim() ?? '';
      const correctIndex = options.findIndex((option) => option === answer);
      return options.length >= 2 && correctIndex !== -1
        ? [{ kind: 'choice' as const, prompt, options, correctIndex, explanation, ...extra }]
        : [];
    }

    const answer = question.answer.trim();
    return answer.length > 0
      ? [{ kind: 'short' as const, prompt, answer, explanation, ...extra }]
      : [];
  });

  if (questions.length === 0) {
    errors.questions = 'Kuis harus punya minimal satu soal yang terisi.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: { title, materialId: draft.materialId, questions } };
}
