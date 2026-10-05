import {
  isItemType,
  isTaskPriority,
  isTaskStatus,
  type Item,
  type Subtask,
} from '../types/item';
import { parseDeadline } from '../utils/date';
import { createId } from '../utils/id';
import { StorageError, readJson, writeJson } from './localStorage';
import { buildSeedItems } from './seedData';

const STORAGE_KEY = 'student-tasks:v1';

function normalizeSubtasks(value: unknown): Subtask[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.title !== 'string') return [];
    return [
      {
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId(),
        title: candidate.title,
        isCompleted: candidate.isCompleted === true,
      },
    ];
  });
}

/**
 * Repairs a stored record so a legacy `Task[]` (no `type`, no `subtasks`) or a
 * partially hand-edited entry becomes a valid Item instead of being discarded.
 */
function normalizeItem(value: unknown): Item | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.title !== 'string') return null;
  if (typeof raw.course !== 'string') return null;
  if (typeof raw.deadline !== 'string' || parseDeadline(raw.deadline) === null) return null;

  const updatedAt =
    typeof raw.updatedAt === 'string' && parseDeadline(raw.updatedAt) !== null
      ? raw.updatedAt
      : new Date().toISOString();
  const createdAt =
    typeof raw.createdAt === 'string' && parseDeadline(raw.createdAt) !== null
      ? raw.createdAt
      : updatedAt;

  return {
    id: raw.id,
    type: isItemType(raw.type) ? raw.type : 'assignment',
    title: raw.title,
    course: raw.course,
    description: typeof raw.description === 'string' ? raw.description : '',
    deadline: raw.deadline,
    priority: isTaskPriority(raw.priority) ? raw.priority : 'Medium',
    status: isTaskStatus(raw.status) ? raw.status : 'To Do',
    subtasks: normalizeSubtasks(raw.subtasks),
    createdAt,
    updatedAt,
  };
}

function parseStored(raw: unknown): Item[] {
  if (!Array.isArray(raw)) {
    throw new StorageError('malformed', 'Data tersimpan rusak dan tidak dapat dibaca.');
  }
  return raw.flatMap((entry) => {
    const item = normalizeItem(entry);
    return item ? [item] : [];
  });
}

function loadAll(): Item[] {
  const raw = readJson<unknown>(STORAGE_KEY);

  // An absent key means a genuine first run, so seed it. A key holding an empty
  // array means the student deleted everything, which we must not undo.
  if (raw === null) {
    const seeded = buildSeedItems();
    writeJson(STORAGE_KEY, seeded);
    return seeded;
  }

  return parseStored(raw);
}

function saveAll(items: Item[]): void {
  writeJson(STORAGE_KEY, items);
}

export const itemRepository = {
  readAll(): Item[] {
    return loadAll();
  },

  insert(item: Item): Item[] {
    const items = loadAll();
    items.push(item);
    saveAll(items);
    return items;
  },

  update(item: Item): Item[] {
    const items = loadAll();
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index !== -1) {
      items[index] = item;
      saveAll(items);
    }
    return items;
  },

  remove(id: string): Item[] {
    const remaining = loadAll().filter((item) => item.id !== id);
    saveAll(remaining);
    return remaining;
  },
};
