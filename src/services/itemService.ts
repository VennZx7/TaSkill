import type { Item, ItemDraft, Subtask, TaskStatus } from '../types/item';
import { isTaskStatus } from '../types/item';
import { inputValueToStorageISO } from '../utils/date';
import { createId } from '../utils/id';
import { validateItemDraft } from '../utils/validation';
import { NotFoundError, ValidationError } from './errors';
import { itemRepository } from './itemRepository';
import { SERVICE_LATENCY_MS as LATENCY_MS, toServiceError, wait } from './shared';

export interface SaveResult {
  item: Item;
  warnings: string[];
}

/** Validates a draft and converts its local datetime into offset ISO. */
function prepare(draft: ItemDraft, now: number): { value: ItemDraft; deadline: string; warnings: string[] } {
  const result = validateItemDraft(draft, now);
  if (!result.ok) throw new ValidationError(result.errors);

  const deadline = inputValueToStorageISO(result.value.deadline);
  if (deadline === null) {
    throw new ValidationError({ deadline: 'Format deadline tidak valid.' });
  }

  return { value: result.value, deadline, warnings: result.warnings };
}

function findOrThrow(id: string): Item {
  const found = itemRepository.readAll().find((item) => item.id === id);
  if (!found) throw new NotFoundError('Item tidak ditemukan. Mungkin sudah dihapus.');
  return found;
}

/** Merges changes into a copy of the item, stamps updatedAt, and persists. */
function persist(item: Item, changes: Partial<Item>): Item {
  const next: Item = { ...item, ...changes, updatedAt: new Date().toISOString() };
  try {
    itemRepository.update(next);
  } catch (error) {
    throw toServiceError(error);
  }
  return next;
}

function withSubtasks(item: Item, subtasks: Subtask[]): Item {
  return persist(item, { subtasks });
}

export async function listItems(): Promise<Item[]> {
  await wait(LATENCY_MS);
  try {
    return itemRepository.readAll();
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function getItem(id: string): Promise<Item | null> {
  await wait(LATENCY_MS);
  try {
    return itemRepository.readAll().find((item) => item.id === id) ?? null;
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function createItem(draft: ItemDraft): Promise<SaveResult> {
  await wait(LATENCY_MS);
  const now = Date.now();
  const { value, deadline, warnings } = prepare(draft, now);
  const timestamp = new Date(now).toISOString();

  const item: Item = {
    id: createId(),
    type: value.type,
    title: value.title,
    course: value.course,
    description: value.description,
    deadline,
    priority: value.priority,
    status: value.status,
    subtasks: value.subtasks.map((subtask) => ({ ...subtask, id: subtask.id || createId() })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    itemRepository.insert(item);
  } catch (error) {
    throw toServiceError(error);
  }
  return { item, warnings };
}

export async function updateItem(id: string, draft: ItemDraft): Promise<SaveResult> {
  await wait(LATENCY_MS);
  const now = Date.now();

  let existing: Item;
  try {
    existing = findOrThrow(id);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    throw toServiceError(error);
  }

  const { value, deadline, warnings } = prepare(draft, now);

  const item: Item = {
    ...existing,
    type: value.type,
    title: value.title,
    course: value.course,
    description: value.description,
    deadline,
    priority: value.priority,
    status: value.status,
    subtasks: value.subtasks.map((subtask) => ({ ...subtask, id: subtask.id || createId() })),
    updatedAt: new Date(now).toISOString(),
  };

  try {
    itemRepository.update(item);
  } catch (error) {
    throw toServiceError(error);
  }
  return { item, warnings };
}

/**
 * Moves an item between kanban columns. A dedicated entry point so a status
 * change never has to reconstruct and re-validate a whole draft.
 */
export async function setItemStatus(id: string, status: TaskStatus): Promise<Item> {
  await wait(LATENCY_MS);
  if (!isTaskStatus(status)) throw new ValidationError({ status: 'Status tidak valid.' });
  return persist(findOrThrow(id), { status });
}

export async function deleteItem(id: string): Promise<void> {
  await wait(LATENCY_MS);
  try {
    itemRepository.remove(id);
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function toggleSubtask(itemId: string, subtaskId: string): Promise<Item> {
  await wait(LATENCY_MS);
  const item = findOrThrow(itemId);
  if (!item.subtasks.some((subtask) => subtask.id === subtaskId)) {
    throw new NotFoundError('Bab tidak ditemukan pada item ini.');
  }
  return withSubtasks(
    item,
    item.subtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, isCompleted: !subtask.isCompleted } : subtask,
    ),
  );
}

export async function addSubtask(itemId: string, title: string): Promise<Item> {
  await wait(LATENCY_MS);
  const clean = title.trim();
  if (clean.length === 0) throw new ValidationError({ title: 'Nama bab tidak boleh kosong.' });

  const item = findOrThrow(itemId);
  return withSubtasks(item, [...item.subtasks, { id: createId(), title: clean, isCompleted: false }]);
}

export async function removeSubtask(itemId: string, subtaskId: string): Promise<Item> {
  await wait(LATENCY_MS);
  const item = findOrThrow(itemId);
  return withSubtasks(
    item,
    item.subtasks.filter((subtask) => subtask.id !== subtaskId),
  );
}
